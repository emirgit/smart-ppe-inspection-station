"""
rfid_spi.py
===========
MOD-03 IoT Module — SPI RFID Reader Implementation

Concrete implementation of RfidReader for the RC522 RFID module
connected directly to the Raspberry Pi 5 via the SPI bus.

Hardware:
    RC522 ↔ Raspberry Pi 5 SPI0
    RC522 PIN   →   RPi PIN
    SDA  (SS)   →   GPIO 8  (CE0) or GPIO 7 (CE1)
    SCK         →   GPIO 11 (SCLK)
    MOSI        →   GPIO 10 (MOSI)
    MISO        →   GPIO 9  (MISO)
    RST         →   GPIO 25 (any free GPIO)
    3.3V / GND  →   3.3V / GND

Dependencies:
    pip install mfrc522

Authors : Alperen Söylen  (220104004024) — Primary
Date    : 2026-04-11
Version : 0.1

Changelog:
    v0.1 (2026-04-11) — Initial implementation
"""

from __future__ import annotations

import time
import logging
from typing import Optional

from ..include.rfid_reader import RfidReader, RfidConfig, RfidMode

logger = logging.getLogger(__name__)

# Poll interval while waiting for a card tap (seconds).
# 50 ms gives ~20 polls/sec without saturating the SPI bus.
_POLL_INTERVAL_S: float = 0.05


class SpiRfidReader(RfidReader):
    """
    Reads RFID card UIDs via the RC522 module over SPI using the
    `mfrc522` library.

    The reader polls the RC522 in a tight loop until either a card is
    detected or the timeout expires.  Card UID is returned as an
    uppercase hex string (e.g. "1A2B3C4D").
    """

    def __init__(self) -> None:
        self._reader = None          # mfrc522.MFRC522 instance, set in init()
        self._config: RfidConfig = RfidConfig()

    # -------------------------------------------------------------------------
    # RfidReader interface
    # -------------------------------------------------------------------------

    def init(self, config: Optional[RfidConfig] = None) -> bool:
        """
        Initialises the RC522 reader on the configured SPI bus/device.

        Args:
            config: Reader configuration. Uses defaults (bus=0, device=0)
                    if None.

        Returns:
            True on success, False if the library fails to open SPI.
        """
        self._config = config or RfidConfig()

        if self._config.mode != RfidMode.SPI:
            logger.error(
                "SpiRfidReader requires mode=SPI, got %s", self._config.mode
            )
            return False

        try:
            from mfrc522 import MFRC522  # imported here; not available on dev PC
            self._reader = MFRC522(
                bus=self._config.spi_bus,
                device=self._config.spi_device,
            )
            logger.info(
                "SpiRfidReader: RC522 initialised on SPI bus=%d device=%d",
                self._config.spi_bus,
                self._config.spi_device,
            )
            return True
        except Exception as exc:
            logger.error("SpiRfidReader: init failed — %s", exc)
            return False

    def read_card(self, timeout_ms: Optional[int] = None) -> Optional[str]:
        """
        Blocks until an RFID card is tapped or the timeout expires.

        Polls the RC522 every 50 ms.  On a successful read the UID bytes
        are joined into an uppercase hex string.

        Args:
            timeout_ms: Maximum wait time in milliseconds.
                        Falls back to config.timeout_ms if None.

        Returns:
            Card UID as an uppercase hex string (e.g. "1A2B3C4D"),
            or None on timeout/error.
        """
        if self._reader is None:
            logger.error("SpiRfidReader: read_card() called before init()")
            return None

        ms = timeout_ms if timeout_ms is not None else self._config.timeout_ms
        deadline = time.monotonic() + ms / 1000.0

        while time.monotonic() < deadline:
            # Step 1: request — check if a card is in the field
            status, _ = self._reader.MFRC522_Request(self._reader.PICC_REQIDL)

            if status == self._reader.MI_OK:
                # Step 2: anti-collision — resolve UID if multiple cards present
                status, uid = self._reader.MFRC522_Anticoll()

                if status == self._reader.MI_OK and uid:
                    card_id = "".join(f"{byte:02X}" for byte in uid[:4])
                    logger.info("SpiRfidReader: card detected — %s", card_id)
                    return card_id

            time.sleep(_POLL_INTERVAL_S)

        logger.debug("SpiRfidReader: read_card() timeout after %d ms", ms)
        return None

    def cleanup(self) -> None:
        """
        Releases GPIO and SPI resources held by the mfrc522 library.
        Safe to call even if init() did not complete successfully.
        """
        try:
            import RPi.GPIO as GPIO  # noqa: N813 — only available on RPi
            GPIO.cleanup()
            logger.info("SpiRfidReader: GPIO cleaned up.")
        except Exception as exc:
            logger.warning("SpiRfidReader: cleanup warning — %s", exc)
        finally:
            self._reader = None
