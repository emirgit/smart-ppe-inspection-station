"""
mock_display_client.py
======================
MOD-03 IoT Module — Mock Display Client

A concrete implementation of DisplayClient that prints colour-coded,
emoji-enhanced status messages to stdout instead of sending WebSocket
or HTTP messages to MOD-05.

Useful for local development and automated tests where the actual
React turnstile display is not running.

Authors : Alperen Söylen  (220104004024) — Primary
Date    : 2026-04-11
Version : 0.1

Changelog:
    v0.1 (2026-04-11) — Initial mock implementation
"""

from __future__ import annotations

from ..include.display_client import DisplayClient


# ANSI colour helpers (gracefully ignored on Windows without colorama)
_RESET  = "\033[0m"
_YELLOW = "\033[93m"
_CYAN   = "\033[96m"
_GREEN  = "\033[92m"
_RED    = "\033[91m"
_GREY   = "\033[90m"


def _log(colour: str, tag: str, message: str) -> None:
    """Prints a colour-coded display log line."""
    print(f"{colour}[MockDisplay] {tag:<18}{_RESET} {message}")


class MockDisplayClient(DisplayClient):
    """
    Simulates the MOD-05 turnstile display by printing to stdout.

    Each method corresponds to one visual state of the real display and
    prints a clearly readable, colour-coded line so you can follow the
    state machine transitions in the terminal.
    """

    # -------------------------------------------------------------------------
    # DisplayClient interface
    # -------------------------------------------------------------------------

    def show_idle(self) -> None:
        """
        Simulates the IDLE / waiting-for-card screen.

        Real display: animated card-scan prompt.
        Mock output:  yellow line with scan instruction.
        """
        _log(_YELLOW, "IDLE", "🟡  Please scan your RFID card to enter.")

    def show_scanning(self) -> None:
        """
        Simulates the INSPECTING / PPE scanning instruction screen.

        Real display: live camera feed with bounding boxes overlay.
        Mock output:  cyan line directing worker to stand in frame.
        """
        _log(_CYAN, "SCANNING", "🔵  Stand in front of the camera for PPE check...")

    def show_granted(self, worker_name: str) -> None:
        """
        Simulates the GRANTED / access-allowed screen.

        Real display: green full-screen banner with worker's name.
        Mock output:  green line with personalised welcome message.

        Args:
            worker_name: Name of the identified worker.
        """
        _log(_GREEN, "GRANTED ✅", f"Welcome, {worker_name}! Gate opening — have a safe shift.")

    def show_denied(self, missing_ppe: list[str]) -> None:
        """
        Simulates the DENIED / missing-PPE screen.

        Real display: red banner listing each undetected PPE item.
        Mock output:  red line listing missing PPE item keys.

        Args:
            missing_ppe: PPE item_key strings that were required but
                         not detected (e.g. ["HELMET", "GLOVES"]).
        """
        items = ", ".join(missing_ppe) if missing_ppe else "—"
        _log(_RED, "DENIED ❌", f"Access denied. Missing PPE: {items}")

    def show_unknown_card(self) -> None:
        """
        Simulates the UNKNOWN CARD / unregistered-card screen.

        Real display: orange banner indicating the card is not in the system.
        Mock output:  grey line indicating an unregistered card.
        """
        _log(_GREY, "UNKNOWN CARD ⛔", "This card is not registered. Please contact your supervisor.")
