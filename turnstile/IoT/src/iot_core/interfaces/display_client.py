"""
display_client.py
=================
MOD-03 IoT Module — Display Client Interface

Defines the abstract interface for pushing display instructions to
MOD-05 (UI/UX — Turnstile Display / Mobile).

The IoT module drives the display by calling these methods at each
stage of the access flow. The underlying transport (WebSocket, HTTP)
is an implementation detail hidden from the caller.

Authors : Alperen Söylen       (220104004024) — Primary
          Zeynep Etik          (220104004035) — Secondary
          Mümincan Durak       (210104004057) — Secondary
          Emre İlhan Şenel    (230104004907) — Secondary
          Hüseyin Elyesa Yeşilyurt (210104004080) — Secondary
Date    : 2026-03-29
Version : 0.1

Changelog:
    v0.1 (2026-03-29) — Initial draft; new file (no prior version)
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional


# =============================================================================
# ABSTRACT CLASS: DISPLAY CLIENT INTERFACE
# =============================================================================

class DisplayClient(ABC):
    """
    Abstract interface for sending display instructions to MOD-05.

    Called by the IoT module at each state transition to inform the
    worker of the current system status via the turnstile display.
    """

    @abstractmethod
    def show_idle(self) -> None:
        """
        Displays the idle/waiting screen.

        Called when the system resets to IDLE state.
        Typical content: "Please scan your card."
        """
        ...

    @abstractmethod
    def show_scanning(self) -> None:
        """
        Displays the PPE scanning instruction screen.

        Called after a valid card is identified and before AI inference runs.
        Typical content: "Please stand in front of the camera."
        """
        ...

    @abstractmethod
    def show_granted(self, worker_name: str) -> None:
        """
        Displays the access granted screen with a welcome message.

        Called after all required PPE is detected and the gate opens.

        Args:
            worker_name: Name of the identified worker to personalise the message.
        """
        ...

    @abstractmethod
    def show_denied(self, missing_ppe: list[str]) -> None:
        """
        Displays the access denied screen with the list of missing PPE items.

        Called when one or more required PPE items are not detected.

        Args:
            missing_ppe: List of PPE class name strings that were required
                         but not detected (e.g. ["HELMET", "GLOVES"]).
        """
        ...

    @abstractmethod
    def show_unknown_card(self) -> None:
        """
        Displays the unregistered card screen.

        Called when the scanned card ID is not found in the backend.
        Typical content: "Card not registered. Access denied."
        """
        ...
