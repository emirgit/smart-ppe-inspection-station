"""
mock_backend_client.py
======================
MOD-03 IoT Module — Mock Backend Client

A concrete implementation of BackendClient that returns hardcoded
worker profiles and logs entry records to stdout, without making
any real HTTP calls to MOD-04.

Fake worker data covers three scenarios used in end-to-end tests:
  1. Known worker — full PPE required  (card "1A2B3C4D")
  2. Known worker — minimal PPE role   (card "CAFEBABE")
  3. Unregistered card                 (any other card ID → returns None)

Authors : Alperen Söylen  (220104004024) — Primary
Date    : 2026-04-11
Version : 0.1

Changelog:
    v0.1 (2026-04-11) — Initial mock implementation
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from typing import Optional

from ..include.backend_client import BackendClient
from ..include.models import WorkerInfo, EntryLog, RequiredPpeItem

def _make_ppe_list(keys: list[str]) -> list[RequiredPpeItem]:
    return [RequiredPpeItem(id=i+1, item_key=k) for i, k in enumerate(keys)]

# =============================================================================
# HARDCODED WORKER DATABASE
# =============================================================================

#: Simulated worker registry keyed by RFID card UID.
#: Add or modify entries here to test different roles / PPE combinations.
FAKE_WORKERS: dict[str, WorkerInfo] = {
    # ── Registered: heavy-duty construction worker (all PPE required) ────────
    "1A2B3C4D": WorkerInfo(
        worker_id=1,
        worker_name="Ahmet Yılmaz",
        role="Construction Worker",
        required_ppe=_make_ppe_list(["HELMET", "VEST", "GLOVES", "SAFETY_BOOTS"]),
    ),
    # ── Registered: site supervisor (lighter PPE requirement) ────────────────
    "CAFEBABE": WorkerInfo(
        worker_id=2,
        worker_name="Zeynep Etik",
        role="Site Supervisor",
        required_ppe=_make_ppe_list(["HELMET", "VEST"]),
    ),
    # ── Registered: lab technician (face protection required) ────────────────
    "DEADBEEF": WorkerInfo(
        worker_id=3,
        worker_name="Mümincan Durak",
        role="Lab Technician",
        required_ppe=_make_ppe_list(["FACE_MASK", "SAFETY_GOGGLES", "GLOVES"]),
    ),
    # NOTE: any card ID not present here returns None → UNKNOWN_CARD decision.
}


# =============================================================================
# MOCK BACKEND CLIENT
# =============================================================================

class MockBackendClient(BackendClient):
    """
    Simulates the MOD-04 REST backend without making any network calls.

    get_worker() returns a WorkerInfo from FAKE_WORKERS, or None for
    unregistered cards.

    log_entry() pretty-prints the entry record to stdout instead of
    POST-ing to the backend.

    Args:
        workers: Optional override for the worker registry.  If omitted,
                 FAKE_WORKERS (module-level dict) is used.
    """

    def __init__(self, workers: Optional[dict[str, WorkerInfo]] = None) -> None:
        self._workers: dict[str, WorkerInfo] = workers if workers is not None else FAKE_WORKERS
        self._log_count: int = 0

    # -------------------------------------------------------------------------
    # BackendClient interface
    # -------------------------------------------------------------------------

    def get_worker(self, card_id: str) -> Optional[WorkerInfo]:
        """
        Looks up a worker by card ID in the local fake registry.

        Args:
            card_id: RFID card UID string.

        Returns:
            WorkerInfo if the card is registered, None otherwise.
        """
        worker = self._workers.get(card_id)

        if worker:
            print(
                f"[MockBackendClient] get_worker({card_id!r}) → "
                f"{worker.worker_name!r} / {worker.role!r} "
                f"(PPE required: {[p.item_key for p in worker.required_ppe]})"
            )
        else:
            print(
                f"[MockBackendClient] get_worker({card_id!r}) → "
                f"None  (card not registered)"
            )

        return worker

    def log_entry(self, log: EntryLog) -> bool:
        """
        Pretty-prints the entry log record to stdout instead of sending it
        to the backend.

        Args:
            log: EntryLog containing card ID, worker ID, decision, PPE lists,
                 and timestamp.

        Returns:
            True (mock always accepts the log).
        """
        self._log_count += 1
        payload = {
            "worker_id":    log.worker_id,
            "rfid_uid_scanned": log.card_id,
            "result":       log.decision.name,
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
        print(
            f"[MockBackendClient] log_entry() #{self._log_count}\n"
            + json.dumps(payload, indent=4, ensure_ascii=False)
        )
        return True
