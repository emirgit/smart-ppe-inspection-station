"""
gate_control.py
===============
MOD-03 IoT Module — Gate Controller

Controls two servo motors through a PCA9685 via Adafruit ServoKit.

Pinout:
    RPi SDA  →  PCA9685 SDA  (I2C1, GPIO 2)
    RPi SCL  →  PCA9685 SCL  (I2C1, GPIO 3)
    PCA9685 channel 0   →  Servo motor 1 (arm left / entry side)
    PCA9685 channel 1   →  Servo motor 2 (arm right / exit side)

    ⚠️  angle_open_deg and angle_closed_deg MUST be tuned on the
        physical hardware before deployment.

Dependencies:
    pip install adafruit-circuitpython-servokit

Authors : Alperen Söylen  (220104004024) — Primary
Date    : 2026-04-11
Version : 0.2

Changelog:
    v0.1 (2026-04-11) — Initial implementation (low-level PCA9685)
    v0.2 (2026-04-18) — Replaced low-level I2C with Adafruit ServoKit
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

logger = logging.getLogger(__name__)


# =============================================================================
# DATACLASS: GATE CONFIGURATION
# =============================================================================

@dataclass
class GateConfig:
    """
    Configuration for the ServoKit-based gate controller.
    All angle values are in degrees (0–180).
    Tune angle_open_deg and angle_closed_deg on the physical hardware.
    """
    channels:          int   = 16    # Number of ServoKit channels (PCA9685 = 16)
    channel_arm1:      int   = 0     # ServoKit channel for servo 1
    channel_arm2:      int   = 1     # ServoKit channel for servo 2
    angle_open_deg:    int   = 90    # ⚠️ TUNE ON HARDWARE — open / unlock position
    angle_closed_deg:  int   = 0     # ⚠️ TUNE ON HARDWARE — closed / locked position
    move_delay_s:      float = 1.0   # Seconds to wait after issuing a move command
    open_duration_s:   float = 5.0   # Seconds the gate stays open before auto-close


# =============================================================================
# CLASS: GATE CONTROLLER
# =============================================================================

class GateController:
    """
    Controls two servo motors via a PCA9685 using Adafruit ServoKit.

    Call init() once before gate_open() / gate_close().
    Call cleanup() on shutdown to zero the PWM signal and release hardware.

    The public API mirrors the function names specified in the MOD-02 C/C++
    header (gate_open / gate_close) so the IoT orchestrator can call this
    the same way regardless of implementation.
    """

    def __init__(self, config: GateConfig = None) -> None:
        self._config = config or GateConfig()
        self._kit    = None   # adafruit_servokit.ServoKit instance

    # -------------------------------------------------------------------------
    # Lifecycle
    # -------------------------------------------------------------------------

    def init(self) -> bool:
        """
        Initialises the ServoKit and moves servos to the closed position.

        Returns:
            True on success, False if ServoKit / hardware is unavailable
            (e.g. running on a dev machine without the PCA9685).
        """
        try:
            from adafruit_servokit import ServoKit

            self._kit = ServoKit(channels=self._config.channels)
            self._set_angle(self._config.angle_closed_deg)
            logger.info(
                "GateController: init OK (ch=%d/%d, open=%d°, closed=%d°)",
                self._config.channel_arm1,
                self._config.channel_arm2,
                self._config.angle_open_deg,
                self._config.angle_closed_deg,
            )
            return True

        except Exception as exc:
            logger.error("GateController: init failed — %s", exc)
            return False

    def cleanup(self) -> None:
        """
        Sets servos to the closed position and releases the ServoKit.
        Safe to call even if init() was not completed successfully.
        """
        if self._kit is not None:
            try:
                self._set_angle(self._config.angle_closed_deg)
                time.sleep(self._config.move_delay_s)
                logger.info("GateController: hardware released.")
            except Exception as exc:
                logger.warning("GateController: cleanup warning — %s", exc)
            finally:
                self._kit = None

    # -------------------------------------------------------------------------
    # Public gate API  (mirrors MOD-02 C/C++ function names)
    # -------------------------------------------------------------------------

    @property
    def open_duration_s(self) -> float:
        """Returns the configured duration to hold the gate open."""
        return self._config.open_duration_s

    def gate_open(self) -> None:
        """
        Rotates both servo arms to the open (unlocked) position.
        Blocks for move_delay_s seconds to allow servos to reach their angle.
        """
        logger.info("GateController: gate_open() → %d°", self._config.angle_open_deg)
        self._set_angle(self._config.angle_open_deg)
        time.sleep(self._config.move_delay_s)

    def gate_close(self) -> None:
        """
        Rotates both servo arms back to the closed (locked) position.
        Blocks for move_delay_s seconds to allow servos to complete travel.
        """
        logger.info("GateController: gate_close() → %d°", self._config.angle_closed_deg)
        self._set_angle(self._config.angle_closed_deg)
        time.sleep(self._config.move_delay_s)

    # -------------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------------

    def _set_angle(self, angle_deg: int) -> None:
        """Sets both servo channels to the given angle simultaneously."""
        if self._kit is None:
            logger.error("GateController: _set_angle() called before init()")
            return
        angle_deg = max(0, min(180, angle_deg))
        try:
            self._kit.servo[self._config.channel_arm1].angle = angle_deg
            self._kit.servo[self._config.channel_arm2].angle = angle_deg
        except Exception as exc:
            logger.error("GateController: _set_angle(%d°) failed — %s", angle_deg, exc)
