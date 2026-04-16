"""
http_backend_client.py
======================
MOD-03 IoT Module — HTTP Backend Client Implementation

Concrete implementation of BackendClient that communicates with the
MOD-04 Express/PostgreSQL REST API over HTTP on the local network.

Endpoints used:
    GET  {base_url}/workers/card/{card_id}   → worker profile + PPE list
    POST {base_url}/entry-logs               → log an inspection result

⚠️  JSON FIELD MAPPING — VERIFY WITH MOD-04 TEAM
    The field names used here are based on the README and models.py.
    The MOD-04 team MUST confirm the exact response/request JSON shapes
    and correct any mismatches before integration.

Dependencies:
    pip install requests

Authors : Alperen Söylen  (220104004024) — Primary
Date    : 2026-04-11
Version : 0.1

Changelog:
    v0.1 (2026-04-11) — Initial implementation
"""

from __future__ import annotations

import logging
import time
from typing import Optional

import requests
from requests.exceptions import RequestException

from ..include.backend_client import BackendClient
from ..include.models import WorkerInfo, EntryLog, RequiredPpeItem

logger = logging.getLogger(__name__)

# Default HTTP request timeout (seconds)
_REQUEST_TIMEOUT_S: int = 5


class HttpBackendClient(BackendClient):
    """
    Communicates with MOD-04 (Express + PostgreSQL) via HTTP REST.

    Args:
        base_url: Root URL of the backend API, without trailing slash.
                  e.g. "http://192.168.1.50:8000/api"
    """

    def __init__(self, base_url: str = "http://localhost:8000/api") -> None:
        self._base_url = base_url.rstrip("/")
        self._session = requests.Session()
        self._session.headers.update({"Content-Type": "application/json"})

    # -------------------------------------------------------------------------
    # BackendClient interface
    # -------------------------------------------------------------------------

    def get_worker(self, card_id: str) -> Optional[WorkerInfo]:
        """
        Retrieves worker profile and required PPE list for a given card ID.

        Calls: GET /api/workers/card/{card_id}

        Expected JSON response shape (⚠️ VERIFY WITH MOD-04):
        {
            "id":           "w001",
            "name":         "Ahmet Yılmaz",
            "role":         "Construction Worker",
            "required_ppe": ["HELMET", "VEST", "GLOVES"]
        }

        Args:
            card_id: RFID card UID string (e.g. "1A2B3C4D").

        Returns:
            WorkerInfo on success, None if card is not registered (404)
            or if the request fails.
        """
        url = f"{self._base_url}/workers/card/{card_id}"
        try:
            response = self._session.get(url, timeout=_REQUEST_TIMEOUT_S)

            if response.status_code == 404:
                logger.info("get_worker(%r): card not registered (404)", card_id)
                return None

            response.raise_for_status()
            payload = response.json()

            if not payload.get("success"):
                logger.error("get_worker(%r): API returned success=False", card_id)
                return None
            
            data = payload["data"]
            worker_data = data["worker"]
            ppe_data = data.get("required_ppe", [])

            # ⚠️ VERIFY FIELD NAMES WITH MOD-04 TEAM
            worker = WorkerInfo(
                worker_id=worker_data["id"],
                worker_name=worker_data["full_name"],
                role=worker_data["role_name"],
                required_ppe=[
                    RequiredPpeItem(
                        id=ppe["id"],
                        item_key=ppe["item_key"],
                        display_name=ppe.get("display_name"),
                        icon_name=ppe.get("icon_name")
                    )
                    for ppe in ppe_data
                ],
            )
            logger.info(
                "get_worker(%r): %s / %s (PPE: %s)",
                card_id, worker.worker_name, worker.role, [p.item_key for p in worker.required_ppe],
            )
            return worker

        except KeyError as exc:
            logger.error(
                "get_worker(%r): unexpected JSON field — %s. "
                "Check field name mapping with MOD-04 team.", card_id, exc
            )
            return None
        except RequestException as exc:
            logger.error("get_worker(%r): HTTP error — %s", card_id, exc)
            return None

    def log_entry(self, log: EntryLog) -> bool:
        """
        Sends an inspection result to the backend for auditing.

        Calls: POST /api/entry-logs

        Request JSON body sent (⚠️ VERIFY WITH MOD-04):
        {
            "card_id":      "1A2B3C4D",
            "worker_id":    "w001",         // null for UNKNOWN_CARD
            "result":       "PASS",         // "PASS" | "FAIL" | "UNKNOWN_CARD"
            "detected_ppe": ["HELMET"],
            "missing_ppe":  ["VEST"],
            "timestamp_ms": 1712834400000
        }

        Args:
            log: EntryLog data to persist.

        Returns:
            True if the backend accepted the log (2xx), False otherwise.
        """
        url = f"{self._base_url}/entry-logs"

        # ⚠️ VERIFY FIELD NAMES WITH MOD-04 TEAM
        payload = {
            "worker_id":          log.worker_id,
            "rfid_uid_scanned":   log.card_id,
            "result":             log.decision.name,
            "inspection_time_ms": log.timestamp_ms or int(time.time() * 1000),
            "camera_snapshot_url": None,
            "detections": [
                {
                    "ppe_item_id": d.ppe_item_id,
                    "was_required": d.was_required,
                    "was_detected": d.was_detected,
                    "confidence": d.confidence
                }
                for d in log.detections
            ]
        }

        try:
            response = self._session.post(
                url, json=payload, timeout=_REQUEST_TIMEOUT_S
            )
            response.raise_for_status()
            logger.info(
                "log_entry(): logged — decision=%s, card=%s",
                log.decision.name, log.card_id,
            )
            return True

        except RequestException as exc:
            logger.error("log_entry(): HTTP error — %s", exc)
            return False
