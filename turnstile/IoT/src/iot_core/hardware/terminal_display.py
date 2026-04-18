"""
terminal_display.py
===================
MOD-03 IoT Module — Development Display Client

A temporary, robust Terminal-based Display Client to use until MOD-05
(Web/Mobile UI) finalizes their network protocol (WebSocket vs SSE).
This prevents the IoT array from crashing when `orchestrator.display.show_x`
is called by providing solid visual terminal outputs with ANSI colored text.

Authors : Alperen Söylen  (220104004024)
Date    : 2026-04-17
Version : 0.1
"""

import logging

from src.iot_core.interfaces.display_client import DisplayClient

logger = logging.getLogger(__name__)

# Basic ANSI escape codes for local terminal visuals
_RESET = "\033[0m"
_RED = "\033[91m"
_GREEN = "\033[92m"
_YELLOW = "\033[93m"
_BLUE = "\033[94m"
_BOLD = "\033[1m"


class TerminalDisplayClient(DisplayClient):
    """
    Prints safety UI screens directly to the console instead of a network display.
    Guarantees that Orchestrator never throws an error due to missing display.
    """

    def show_idle(self) -> None:
        logger.info(f"{_BLUE}{_BOLD}>>> DISPLAY [IDLE]: Lütfen Kartınızı Okutun (Please scan your card...){_RESET}")

    def show_scanning(self) -> None:
        logger.info(f"{_YELLOW}{_BOLD}>>> DISPLAY [SCANNING]: Kamera Önünde Bekleyin (Please stand in front of the camera...){_RESET}")

    def show_granted(self, worker_name: str) -> None:
        logger.info(f"{_GREEN}{_BOLD}>>> DISPLAY [GRANTED]: Erişim Onaylandı. Hoşgeldiniz, {worker_name}.{_RESET}")

    def show_denied(self, missing_ppe: list[str]) -> None:
        items = ", ".join(missing_ppe)
        logger.info(f"{_RED}{_BOLD}>>> DISPLAY [DENIED]: EKİPMAN EKSİK! Lütfen Tamamlayın: {items}{_RESET}")

    def show_unknown_card(self) -> None:
        logger.info(f"{_RED}{_BOLD}>>> DISPLAY [UNKNOWN CARD]: KART GEÇERSİZ! Kayıtsız Kullanıcı.{_RESET}")
