"""
ws_display_client.py
====================
MOD-03 IoT Module — WebSocket Display Server Implementation

Runs a WebSocket server on the Raspberry Pi so MOD-05 (Turnstile Display
Application) can connect as a client at ws://<RPi-IP>:8080/ws/display.

Broadcasts each state transition to all connected display clients. A
background asyncio event loop handles the server; notify_* calls from the
orchestrator thread are forwarded via run_coroutine_threadsafe, so the
orchestrator is never blocked by network I/O. A new client that connects
mid-cycle receives the most recently cached payload immediately so the
display is never stale.

Dependencies:
    pip install 'websockets>=12,<15'

Authors : Alperen Söylen       (220104004024)
          Zeynep Etik          (220104004035)
Date    : 2026-04-17
Version : 0.2
"""

from __future__ import annotations

import asyncio
import datetime
import json
import logging
import threading
from typing import Any, Dict, List, Optional, Set

try:
    from websockets.asyncio.server import serve, ServerConnection
except ImportError as exc:
    raise ImportError(
        "websockets>=12 is required. Install with: pip install 'websockets>=12,<15'"
    ) from exc

from src.iot_core.interfaces.display_client import DisplayClient
from src.iot_core.models import WorkerInfo

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.datetime.utcnow().isoformat() + "Z"


def _serialize_worker(worker: WorkerInfo) -> Dict[str, Any]:
    return {
        "id": worker.worker_id,
        "full_name": worker.worker_name,
        "role_name": worker.role,
        "photo_url": None,
    }


def _serialize_req_ppe(worker: WorkerInfo) -> List[Dict[str, Any]]:
    out = []
    for item in worker.required_ppe:
        out.append({
            "id": getattr(item, "id", -1),
            "item_key": item.item_key,
            "display_name": getattr(item, "display_name", item.item_key) or item.item_key,
            "icon_name": getattr(item, "icon_name", item.item_key) or item.item_key,
        })
    return out


def _serialize_detected_ppe(keys: List[str], worker: WorkerInfo) -> List[Dict[str, Any]]:
    req_map = {p.item_key: p for p in worker.required_ppe}
    out = []
    for k in keys:
        if k in req_map:
            p = req_map[k]
            out.append({
                "id": getattr(p, "id", -1),
                "item_key": p.item_key,
                "display_name": getattr(p, "display_name", p.item_key) or p.item_key,
                "icon_name": getattr(p, "icon_name", p.item_key) or p.item_key,
            })
        else:
            out.append({"id": -1, "item_key": k, "display_name": k, "icon_name": k})
    return out


# ---------------------------------------------------------------------------
# WebSocket server
# ---------------------------------------------------------------------------

class WebSocketDisplayNotifier(DisplayClient):
    """
    WebSocket server that pushes rich screen states to MOD-05.

    The server runs in a daemon thread with its own asyncio event loop.
    notify_* calls from the orchestrator thread enqueue coroutines on that
    loop via run_coroutine_threadsafe so the orchestrator is never blocked.
    """

    def __init__(
        self,
        host: str = "0.0.0.0",
        port: int = 8080,
        path: str = "/ws/display",
    ) -> None:
        self._host = host
        self._port = port
        self._path = path

        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._stop_signal: Optional[asyncio.Event] = None
        self._clients: Set[ServerConnection] = set()

        # Guarded by _payload_lock; read from asyncio thread, written from orchestrator thread.
        self._last_payload: Optional[str] = None
        self._payload_lock = threading.Lock()

        self._ready_event = threading.Event()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

        if not self._ready_event.wait(timeout=5.0):
            logger.warning("WebSocket display server did not start within 5 seconds")
        else:
            logger.info(
                "WebSocket display server listening on ws://%s:%d%s",
                host, port, path,
            )

    # ------------------------------------------------------------------
    # Server lifecycle (runs on the daemon thread)
    # ------------------------------------------------------------------

    def _run_loop(self) -> None:
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._serve())
        finally:
            self._loop.close()

    async def _serve(self) -> None:
        self._stop_signal = asyncio.Event()
        async with serve(self._handler, self._host, self._port):
            self._ready_event.set()
            await self._stop_signal.wait()

    async def _handler(self, ws: ServerConnection) -> None:
        if ws.request.path != self._path:
            await ws.close(1008, "policy violation")
            return

        self._clients.add(ws)
        logger.debug("Display client connected (%d total)", len(self._clients))

        # Replay the most recent state so a late-connecting display is not stale.
        with self._payload_lock:
            cached = self._last_payload
        if cached:
            try:
                await ws.send(cached)
            except Exception:
                pass

        try:
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                    msg_type = msg.get("type", "")
                    if msg_type == "DISPLAY_READY":
                        logger.info("DISPLAY_READY from client_id=%s", msg.get("client_id"))
                    elif msg_type == "DISPLAY_ACK":
                        logger.debug("DISPLAY_ACK state=%s", msg.get("acknowledged_state"))
                except Exception:
                    pass
        except Exception:
            pass
        finally:
            self._clients.discard(ws)
            logger.debug("Display client disconnected (%d remaining)", len(self._clients))

    async def _broadcast(self, message: str) -> None:
        for ws in list(self._clients):
            try:
                await ws.send(message)
            except Exception:
                self._clients.discard(ws)

    def stop(self) -> None:
        if self._loop and self._stop_signal:
            self._loop.call_soon_threadsafe(self._stop_signal.set)
        self._thread.join(timeout=5.0)

    # ------------------------------------------------------------------
    # Internal helper (called from orchestrator thread)
    # ------------------------------------------------------------------

    def _send_payload(self, state: str, data: Dict[str, Any]) -> None:
        payload = data.copy()
        payload["state"] = state
        payload["timestamp"] = _now_iso()
        json_str = json.dumps(payload)

        with self._payload_lock:
            self._last_payload = json_str

        if self._loop and not self._loop.is_closed():
            asyncio.run_coroutine_threadsafe(self._broadcast(json_str), self._loop)
        else:
            logger.warning("DisplayServer: event loop not running, dropping %s", state)

    # ------------------------------------------------------------------
    # DisplayClient interface
    # ------------------------------------------------------------------

    def notify_idle(self) -> None:
        self._send_payload("IDLE", {})

    def notify_identifying(self, rfid_card_uid: str) -> None:
        self._send_payload("IDENTIFYING", {"rfid_card_uid": rfid_card_uid})

    def notify_unknown_card(self, rfid_card_uid: str) -> None:
        self._send_payload("UNKNOWN_CARD", {"rfid_card_uid": rfid_card_uid})

    def notify_inspecting(
        self,
        worker: WorkerInfo,
        instruction: str = "Lütfen kameraya bakın ve bekleyin",
    ) -> None:
        self._send_payload("INSPECTING", {
            "worker": _serialize_worker(worker),
            "required_ppe": _serialize_req_ppe(worker),
            "instruction": instruction,
        })

    def notify_pass(self, worker: WorkerInfo, detected_ppe: List[str]) -> None:
        self._send_payload("PASS", {
            "worker": _serialize_worker(worker),
            "detected_ppe": _serialize_detected_ppe(detected_ppe, worker),
        })

    def notify_fail(
        self,
        worker: WorkerInfo,
        detected_ppe: List[str],
        missing_ppe: List[str],
    ) -> None:
        self._send_payload("FAIL", {
            "worker": _serialize_worker(worker),
            "detected_ppe": _serialize_detected_ppe(detected_ppe, worker),
            "missing_ppe": _serialize_detected_ppe(missing_ppe, worker),
        })
