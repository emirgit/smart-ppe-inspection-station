"""
mock_display_notifier.py
========================
MOD-03 IoT Module — In-process DisplayNotifier for tests / dev

Records every notification into an in-memory list (and optionally
prints a one-line summary) instead of opening a WebSocket.  Used by
the orchestrator's unit tests and by anyone running the IoT module
without the React display attached.

Authors : Emre İlhan Şenel    (230104004907) — Primary
Date    : 2026-04-17
Version : 0.1
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from ..include.display_notifier import DisplayNotifier
from ..include.models import RequiredPpeItem, WorkerInfo

logger = logging.getLogger(__name__)


class MockDisplayNotifier(DisplayNotifier):
    """
    DisplayNotifier that captures every event in :attr:`events` so
    tests can assert on the wire-format payloads without booting a
    server.

    :attr:`events` is a list of ``(state, kwargs)`` tuples preserving
    call order; ``kwargs`` mirrors the keyword arguments the production
    notifier would serialise.
    """

    def __init__(self, log: bool = False) -> None:
        self._log = log
        self.events: list[tuple[str, dict[str, Any]]] = []
        self.started: bool = False

    # -------------------------------------------------------------------------
    # Lifecycle
    # -------------------------------------------------------------------------

    def start(self) -> None:
        self.started = True
        if self._log:
            logger.info("[MockDisplayNotifier] start()")

    def stop(self) -> None:
        self.started = False
        if self._log:
            logger.info("[MockDisplayNotifier] stop()")

    # -------------------------------------------------------------------------
    # DisplayNotifier interface
    # -------------------------------------------------------------------------

    def notify_idle(self) -> None:
        self._record("IDLE", {})

    def notify_identifying(self, rfid_card_uid: str) -> None:
        self._record("IDENTIFYING", {"rfid_card_uid": rfid_card_uid})

    def notify_unknown_card(self, rfid_card_uid: str) -> None:
        self._record("UNKNOWN_CARD", {"rfid_card_uid": rfid_card_uid})

    def notify_inspecting(
        self,
        worker:        WorkerInfo,
        required_ppe:  list[RequiredPpeItem],
        instruction:   Optional[str] = None,
    ) -> None:
        self._record("INSPECTING", {
            "worker":       worker,
            "required_ppe": list(required_ppe),
            "instruction":  instruction,
        })

    def notify_pass(
        self,
        worker:        WorkerInfo,
        detected_ppe:  list[RequiredPpeItem],
    ) -> None:
        self._record("PASS", {
            "worker":       worker,
            "detected_ppe": list(detected_ppe),
        })

    def notify_fail(
        self,
        worker:        WorkerInfo,
        detected_ppe:  list[RequiredPpeItem],
        missing_ppe:   list[RequiredPpeItem],
    ) -> None:
        self._record("FAIL", {
            "worker":       worker,
            "detected_ppe": list(detected_ppe),
            "missing_ppe":  list(missing_ppe),
        })

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    def _record(self, state: str, kwargs: dict[str, Any]) -> None:
        self.events.append((state, kwargs))
        if self._log:
            logger.info("[MockDisplayNotifier] %s %s", state, kwargs)

    def states(self) -> list[str]:
        """Convenience: returns the recorded state names in order."""
        return [state for state, _ in self.events]

    def reset(self) -> None:
        """Clears the captured event log."""
        self.events.clear()
