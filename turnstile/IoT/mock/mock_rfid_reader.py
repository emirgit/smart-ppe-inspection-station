"""
mock_rfid_reader.py
===================
MOD-03 IoT Module — Mock RFID Reader

A concrete implementation of RfidReader that simulates card scans without
any physical RC522 hardware or SPI bus.

Behaviour:
  - init()      : always succeeds (prints confirmation).
  - read_card() : pauses at an input() prompt so the tester can control
                  exactly when a card is "scanned".  Each call cycles
                  through the list of provided card IDs in order.
                  Pass an empty list to simulate a permanent timeout.
  - cleanup()   : no-op (nothing to release).

Authors : Alperen Söylen  (220104004024) — Primary
Date    : 2026-04-11
Version : 0.1

Changelog:
    v0.1 (2026-04-11) — Initial mock implementation
"""

from __future__ import annotations

from typing import Optional

from ..include.rfid_reader import RfidReader, RfidConfig


class MockRfidReader(RfidReader):
    """
    Simulates an RFID reader by cycling through a fixed list of card IDs.

    Each call to read_card() blocks on input() so the developer controls
    exactly when a card is presented. This lets you step through the
    state machine one scan at a time during local development.

    Args:
        card_ids: Ordered list of card UID strings to return on successive
                  read_card() calls. Cycles back to the start when exhausted.
                  Pass an empty list to make every read_card() return None
                  (simulates a permanent timeout / no card).

    Example:
        reader = MockRfidReader(["1A2B3C4D", "DEADBEEF", "UNKNOWN00"])
    """

    def __init__(self, card_ids: Optional[list[str]] = None) -> None:
        self._cards: list[str] = card_ids if card_ids is not None else ["1A2B3C4D"]
        self._index: int = 0

    # -------------------------------------------------------------------------
    # RfidReader interface
    # -------------------------------------------------------------------------

    def init(self, config: Optional[RfidConfig] = None) -> bool:
        """
        Simulates hardware initialisation — always succeeds.

        Args:
            config: Ignored by the mock; accepted for interface compatibility.

        Returns:
            True (mock always initialises successfully).
        """
        cfg = config or RfidConfig()
        print(
            f"[MockRfidReader] init() OK  "
            f"(mode={cfg.mode.value}, {len(self._cards)} card(s) loaded)"
        )
        return True

    def read_card(self, timeout_ms: Optional[int] = None) -> Optional[str]:
        """
        Blocks at an interactive prompt until the developer presses ENTER,
        then returns the next card ID from the rotation list.

        Args:
            timeout_ms: Ignored by the mock; accepted for interface compatibility.

        Returns:
            Next card UID string in the rotation, or None if no cards were
            provided.
        """
        if not self._cards:
            print("[MockRfidReader] read_card() → None  (no cards configured)")
            return None

        card_id = self._cards[self._index % len(self._cards)]

        print(f"\n[MockRfidReader] Ready to scan. Next card will be: {card_id!r}")
        try:
            input("  ↳ Press ENTER to simulate card scan (or Ctrl+C to stop)... ")
        except KeyboardInterrupt:
            print("\n[MockRfidReader] Interrupted by user.")
            return None

        self._index += 1
        print(f"[MockRfidReader] read_card() → {card_id!r}")
        return card_id

    def cleanup(self) -> None:
        """
        No hardware resources to release — prints a confirmation and returns.
        """
        print("[MockRfidReader] cleanup() — nothing to release.")
