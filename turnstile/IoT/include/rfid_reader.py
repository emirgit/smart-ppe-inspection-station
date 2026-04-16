"""
rfid_reader.py
==============
MOD-03 IoT Module — RFID Reader Interface

Defines the abstract interface for reading RFID card IDs.
Whether the reader is connected via SPI directly to the Raspberry Pi
or via an ESP32 over WiFi is an implementation detail hidden from callers.

Authors : Alperen Söylen       (220104004024) — Primary
          Zeynep Etik          (220104004035) — Secondary
          Mümincan Durak       (210104004057) — Secondary
          Emre İlhan Şenel    (230104004907) — Secondary
          Hüseyin Elyesa Yeşilyurt (210104004080) — Secondary
Date    : 2026-03-29
Version : 0.2

Changelog:
    v0.1 (2026-03-29) — Initial draft as concrete implementation with SPI/WiFi logic
    v0.2 (2026-03-29) — Rewritten as abstract interface; implementation details removed
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Optional


# =============================================================================
# ENUM: RFID CONNECTION MODE
# =============================================================================

class RfidMode(Enum):
    """Physical connection mode of the RC522 RFID reader."""
    SPI  = "spi"   # RC522 connected directly to Raspberry Pi via SPI
    WIFI = "wifi"  # RC522 connected via ESP32 over local WiFi (HTTP)


# =============================================================================
# DATACLASS: RFID CONFIGURATION
# =============================================================================

@dataclass
class RfidConfig:
    """Configuration parameters for RfidReader.init()."""
    mode:         RfidMode = RfidMode.SPI
    wifi_url:     str      = "http://192.168.1.100:8080"  # used when mode=WIFI
    spi_bus:      int      = 0                            # used when mode=SPI
    spi_device:   int      = 0                            # used when mode=SPI
    timeout_ms:   int      = 30000                        # read timeout (ms)


# =============================================================================
# ABSTRACT CLASS: RFID READER INTERFACE
# =============================================================================

class RfidReader(ABC):
    """
    Abstract interface for the RFID card reader.

    The caller receives a card UID string and passes it to the backend.
    The caller does not need to know whether reading is done over SPI or WiFi.
    """

    @abstractmethod
    def init(self, config: Optional[RfidConfig] = None) -> bool:
        """
        Initializes the reader hardware or network connection.

        Must be called once before read_card().

        Args:
            config: Reader configuration. If None, defaults are used.

        Returns:
            True on success, False on failure.
        """
        ...

    @abstractmethod
    def read_card(self, timeout_ms: Optional[int] = None) -> Optional[str]:
        """
        Blocks until an RFID card is detected or the timeout expires.

        Args:
            timeout_ms: Maximum wait time in milliseconds.
                        If None, uses the value from config.

        Returns:
            Card UID as a hex string (e.g. "1A2B3C4D"), or None on timeout/error.
        """
        ...

    @abstractmethod
    def cleanup(self) -> None:
        """
        Releases GPIO, SPI, or network resources held by the reader.

        Safe to call even if init() was not completed successfully.
        """
        ...
