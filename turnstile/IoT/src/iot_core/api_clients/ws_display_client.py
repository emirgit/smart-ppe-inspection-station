"""
ws_display_client.py
====================
MOD-03 IoT Module — WebSocket Display Client Implementation

Concrete implementation of DisplayClient that communicates with
MOD-05 (Turnstile Display Application) over a WebSocket connection.

Uses a background thread and a message queue to ensure that calling
display updates never blocks the main IoT orchestrator, even if the
display app is disconnected or the network drops.

Dependencies:
    pip install websocket-client

Authors : Alperen Söylen       (220104004024)
          Zeynep Etik          (220104004035)
Date    : 2026-04-17
Version : 0.1
"""

from __future__ import annotations

import datetime
import json
import logging
import queue
import threading
import time
from typing import Any, Dict, Optional, List

# Expected dependency: pip install websocket-client
import websocket

from src.iot_core.interfaces.display_client import DisplayClient
from src.iot_core.models import WorkerInfo

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.datetime.utcnow().isoformat() + "Z"

def _serialize_worker(worker: WorkerInfo) -> Dict[str, Any]:
    return {
        "id": worker.worker_id,
        "full_name": worker.worker_name,
        "role_name": worker.role,
        "photo_url": None
    }

def _serialize_req_ppe(worker: WorkerInfo) -> List[Dict[str, Any]]:
    out = []
    for item in worker.required_ppe:
        out.append({
            "id": getattr(item, "id", -1),
            "item_key": item.item_key,
            "display_name": getattr(item, "display_name", item.item_key) or item.item_key,
            "icon_name": getattr(item, "icon_name", item.item_key) or item.item_key
        })
    return out

def _serialize_detected_ppe(keys: List[str], worker: WorkerInfo) -> List[Dict[str, Any]]:
    # Map item_keys to rich objects from required_ppe
    req_map = {p.item_key: p for p in worker.required_ppe}
    out = []
    for k in keys:
        if k in req_map:
            p = req_map[k]
            out.append({
                "id": getattr(p, "id", -1),
                "item_key": p.item_key,
                "display_name": getattr(p, "display_name", p.item_key) or p.item_key,
                "icon_name": getattr(p, "icon_name", p.item_key) or p.item_key
            })
        else:
            out.append({
                "id": -1,
                "item_key": k,
                "display_name": k,
                "icon_name": k
            })
    return out

class WebSocketDisplayNotifier:
    """
    Non-blocking WebSocket notifier that pushes rich screen states to MOD-05
    following the DISPLAY_BRIDGE contract.
    """

    def __init__(self, ws_url: str = "ws://localhost:3000/ws"):
        self._ws_url = ws_url
        self._ws: Optional[websocket.WebSocket] = None
        self._msg_queue: queue.Queue[str] = queue.Queue(maxsize=50)
        self._stop_event = threading.Event()
        
        # Start background thread to handle socket connections and sends
        self._worker_thread = threading.Thread(target=self._connection_worker, daemon=True)
        self._worker_thread.start()
        logger.info("WebSocketDisplayClient initialized, targeting %s", ws_url)

    def stop(self) -> None:
        """Stops the background worker and closes the socket cleanly."""
        self._stop_event.set()
        if self._ws:
            try:
                self._ws.close()
            except Exception:
                pass
        self._worker_thread.join(timeout=2.0)

    def _send_payload(self, state: str, data: Dict[str, Any]) -> None:
        """Serializes the event state to JSON and puts it in the background queue."""
        payload = data.copy()
        payload["state"] = state
        payload["timestamp"] = _now_iso()
        try:
            self._msg_queue.put_nowait(json.dumps(payload))
            logger.debug("DisplayClient Queued: %s", state)
        except queue.Full:
            logger.warning("WebSocketDisplayClient Queue Full! Dropping state update: %s", state)

    # -------------------------------------------------------------------------
    # DisplayNotifier Interface Methods (Per DISPLAY_BRIDGE.md)
    # -------------------------------------------------------------------------

    def notify_idle(self) -> None:
        self._send_payload("IDLE", {})

    def notify_identifying(self, rfid_card_uid: str) -> None:
        self._send_payload("IDENTIFYING", {"rfid_card_uid": rfid_card_uid})

    def notify_unknown_card(self, rfid_card_uid: str) -> None:
        self._send_payload("UNKNOWN_CARD", {"rfid_card_uid": rfid_card_uid})

    def notify_inspecting(self, worker: WorkerInfo, instruction: str = "Lütfen kameraya bakın ve bekleyin") -> None:
        self._send_payload("INSPECTING", {
            "worker": _serialize_worker(worker),
            "required_ppe": _serialize_req_ppe(worker),
            "instruction": instruction
        })

    def notify_pass(self, worker: WorkerInfo, detected_ppe: List[str]) -> None:
        self._send_payload("PASS", {
            "worker": _serialize_worker(worker),
            "detected_ppe": _serialize_detected_ppe(detected_ppe, worker)
        })

    def notify_fail(self, worker: WorkerInfo, detected_ppe: List[str], missing_ppe: List[str]) -> None:
        self._send_payload("FAIL", {
            "worker": _serialize_worker(worker),
            "detected_ppe": _serialize_detected_ppe(detected_ppe, worker),
            "missing_ppe": _serialize_detected_ppe(missing_ppe, worker)
        })

    # -------------------------------------------------------------------------
    # Legacy fallbacks (if used as DisplayClient directly instead of Notifier)
    # -------------------------------------------------------------------------
    
    def show_idle(self) -> None:
        self.notify_idle()

    def show_scanning(self) -> None:
        self.notify_identifying("UKNOWN_UID")

    def show_granted(self, worker_name: str) -> None:
        self._send_payload("PASS", {"worker": {"full_name": worker_name, "id": -1, "role_name": "Unknown", "photo_url": None}})

    def show_denied(self, missing_ppe: list[str]) -> None:
        self._send_payload("FAIL", {
            "worker": {"full_name": "Unknown", "id": -1, "role_name": "Unknown", "photo_url": None},
            "missing_ppe": [{"id": -1, "item_key": ppe, "display_name": ppe, "icon_name": ppe} for ppe in missing_ppe]
        })

    def show_unknown_card(self) -> None:
        self.notify_unknown_card("UNKNOWN_UID")

    # -------------------------------------------------------------------------
    # Background Worker
    # -------------------------------------------------------------------------

    def _connection_worker(self) -> None:
        """
        Maintains the WebSocket connection. Reads from the queue and sends.
        Reconnects automatically if the tablet display drops.
        """
        while not self._stop_event.is_set():
            # 1. Ensure Connected
            if self._ws is None or not self._ws.connected:
                try:
                    self._ws = websocket.create_connection(self._ws_url, timeout=3)
                    logger.info("WebSocketDisplayClient: Connected to MOD-05 at %s", self._ws_url)
                except Exception as exc:
                    # Connection failed, wait and retry
                    logger.debug("WebSocketDisplayClient: Reconnect failed (%s), retrying...", exc)
                    time.sleep(3)
                    continue

            # 2. Process Queue
            try:
                # Wait 1 sec for a message so we can periodically check _stop_event
                msg = self._msg_queue.get(timeout=1.0)
                self._ws.send(msg)
            except queue.Empty:
                continue
            except Exception as exc:
                logger.warning("WebSocketDisplayClient: Send error (%s). Socket dropped.", exc)
                if self._ws:
                    try:
                        self._ws.close()
                    except Exception:
                        pass
                self._ws = None  # Will trigger reconnect on next loop iter
