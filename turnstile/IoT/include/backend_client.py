"""
backend_client.py
=================
MOD-03 IoT Module — Backend Client Interface

Defines the abstract interface for communicating with MOD-04 (Backend).
The IoT module uses this to look up worker information by card ID
and to log every access attempt for auditing.

Authors : Alperen Söylen       (220104004024) — Primary
          Zeynep Etik          (220104004035) — Secondary
          Mümincan Durak       (210104004057) — Secondary
          Emre İlhan Şenel    (230104004907) — Secondary
          Hüseyin Elyesa Yeşilyurt (210104004080) — Secondary
Date    : 2026-03-29
Version : 0.2

Changelog:
    v0.1 (2026-03-29) — Initial draft as concrete HTTP client implementation
    v0.2 (2026-03-29) — Rewritten as abstract interface; HTTP logic removed
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from .models import WorkerInfo, EntryLog


# =============================================================================
# ABSTRACT CLASS: BACKEND CLIENT INTERFACE
# =============================================================================

class BackendClient(ABC):
    """
    Abstract interface for MOD-04 (Backend & Database) communication.

    All communication is over HTTP REST on the local network.
    """

    @abstractmethod
    def get_worker(self, card_id: str) -> Optional[WorkerInfo]:
        """
        Retrieves worker profile and required PPE list for a given card ID.

        Called immediately after an RFID card is read.

        Args:
            card_id: RFID card UID string as returned by RfidReader.read_card().

        Returns:
            WorkerInfo with worker name, role, and required PPE list.
            None if the card is not registered or the request fails.
        """
        ...

    @abstractmethod
    def log_entry(self, log: EntryLog) -> bool:
        """
        Sends an access attempt record to the backend for auditing.

        Called after every access decision (GRANTED or DENIED).

        Args:
            log: EntryLog containing card ID, worker ID, decision, PPE lists,
                 and timestamp.

        Returns:
            True if the log was accepted by the backend, False otherwise.
        """
        ...
