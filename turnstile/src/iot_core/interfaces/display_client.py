"""
display_client.py
=================
MOD-03 IoT Module — Display Client Interface

Defines the abstract interface for pushing rich screen states to
MOD-05 (UI/UX — Turnstile Display). The payload contract is defined
in turnstile/IoT/DISPLAY_BRIDGE.md; concrete transports (WebSocket,
HTTP, terminal) implement this ABC.

The IoT orchestrator calls these methods at each stage of the access
flow, passing real worker, card, and detection data — never placeholder
or "Unknown" values.

Authors : Alperen Söylen       (220104004024) — Primary
          Zeynep Etik          (220104004035) — Secondary
          Mümincan Durak       (210104004057) — Secondary
          Emre İlhan Şenel    (230104004907) — Secondary
          Hüseyin Elyesa Yeşilyurt (210104004080) — Secondary
Date    : 2026-05-19
Version : 0.2

Changelog:
    v0.1 (2026-03-29) — Initial draft with show_* methods.
    v0.2 (2026-05-19) — Replaced placeholder show_* API with rich notify_*
                          API matching DISPLAY_BRIDGE.md (real worker / PPE
                          context per call).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.iot_core.models import WorkerInfo


class DisplayClient(ABC):
    """
    Abstract interface for sending screen states to MOD-05.

    Each method corresponds to one screen state defined by DISPLAY_BRIDGE.md.
    Implementations are responsible only for transport (e.g. WebSocket).
    """

    @abstractmethod
    def notify_idle(self) -> None:
        """Idle screen: waiting for a card scan."""
        ...

    @abstractmethod
    def notify_identifying(self, rfid_card_uid: str) -> None:
        """Card scanned; backend lookup in progress."""
        ...

    @abstractmethod
    def notify_unknown_card(self, rfid_card_uid: str) -> None:
        """Card not registered in the backend."""
        ...

    @abstractmethod
    def notify_inspecting(
        self,
        worker: "WorkerInfo",
        instruction: str = "Lütfen kameraya bakın ve bekleyin",
    ) -> None:
        """Worker identified; PPE inspection in progress."""
        ...

    @abstractmethod
    def notify_pass(
        self,
        worker: "WorkerInfo",
        detected_ppe: list[str],
    ) -> None:
        """All required PPE detected; gate opening."""
        ...

    @abstractmethod
    def notify_fail(
        self,
        worker: "WorkerInfo",
        detected_ppe: list[str],
        missing_ppe: list[str],
    ) -> None:
        """One or more required PPE items missing; access denied."""
        ...

    def stop(self) -> None:
        """
        Releases any transport-level resources (background threads, sockets).

        Default no-op so simple implementations (terminal) can ignore it.
        """
        return None
