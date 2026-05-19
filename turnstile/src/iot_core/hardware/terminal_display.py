"""
terminal_display.py
===================
MOD-03 IoT Module — Development Display Client

A development-only DisplayClient that renders screen-state events as ANSI
colored log lines instead of sending them over a network transport. Used
when MOD-05 is not reachable (no tablet on the bench), so the orchestrator
can still drive a full cycle locally.

Implements the same notify_* API as WebSocketDisplayNotifier so it can be
swapped in without changes to the orchestrator.

Authors : Alperen Söylen  (220104004024)
Date    : 2026-05-19
Version : 0.2

Changelog:
    v0.1 (2026-04-17) — Initial show_* implementation.
    v0.2 (2026-05-19) — Switched to notify_* contract matching DISPLAY_BRIDGE.md.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from src.iot_core.interfaces.display_client import DisplayClient

if TYPE_CHECKING:
    from src.iot_core.models import WorkerInfo

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
    Renders screen states to the console using ANSI colors.
    Used as a stand-in for MOD-05 during bench testing.
    """

    def notify_idle(self) -> None:
        logger.info(
            f"{_BLUE}{_BOLD}>>> DISPLAY [IDLE]: Lütfen Kartınızı Okutun "
            f"(Please scan your card...){_RESET}"
        )

    def notify_identifying(self, rfid_card_uid: str) -> None:
        logger.info(
            f"{_YELLOW}{_BOLD}>>> DISPLAY [IDENTIFYING]: Kart okundu "
            f"(uid={rfid_card_uid}). Kayıt sorgulanıyor...{_RESET}"
        )

    def notify_unknown_card(self, rfid_card_uid: str) -> None:
        logger.info(
            f"{_RED}{_BOLD}>>> DISPLAY [UNKNOWN_CARD]: KART GEÇERSİZ! "
            f"Kayıtsız kullanıcı (uid={rfid_card_uid}).{_RESET}"
        )

    def notify_inspecting(
        self,
        worker: "WorkerInfo",
        instruction: str = "Lütfen kameraya bakın ve bekleyin",
    ) -> None:
        required = ", ".join(p.item_key for p in worker.required_ppe) or "(none)"
        logger.info(
            f"{_YELLOW}{_BOLD}>>> DISPLAY [INSPECTING]: {worker.worker_name} "
            f"({worker.role}) — gerekli PPE: {required}. {instruction}.{_RESET}"
        )

    def notify_pass(
        self,
        worker: "WorkerInfo",
        detected_ppe: list[str],
    ) -> None:
        detected = ", ".join(detected_ppe) or "(none)"
        logger.info(
            f"{_GREEN}{_BOLD}>>> DISPLAY [PASS]: Erişim Onaylandı. "
            f"Hoşgeldiniz, {worker.worker_name}. Algılanan: {detected}.{_RESET}"
        )

    def notify_fail(
        self,
        worker: "WorkerInfo",
        detected_ppe: list[str],
        missing_ppe: list[str],
    ) -> None:
        missing = ", ".join(missing_ppe) or "(none)"
        detected = ", ".join(detected_ppe) or "(none)"
        logger.info(
            f"{_RED}{_BOLD}>>> DISPLAY [FAIL]: {worker.worker_name} — "
            f"EKİPMAN EKSİK! Lütfen tamamlayın: {missing}. "
            f"Algılanan: {detected}.{_RESET}"
        )
