"""
gate_control.py
===============
MOD-03 IoT Module — Gate Controller

⚠️  NEW FILE — not defined in include/.
    MOD-02 (Gate Control) is officially C/C++, but the team decided to
    implement gate_open() / gate_close() directly in Python via PWM
    to the PCA9685 I2C servo driver board.

Controls two servo motors through a PCA9685 I2C PWM controller.
Pinout:
    RPi 5 SDA  →  PCA9685 SDA  (I2C1, GPIO 2)
    RPi 5 SCL  →  PCA9685 SCL  (I2C1, GPIO 3)
    PCA9685 I2C address: 0x40 (default, ADDR pin low)
    PCA9685 channel 0   →  Servo motor 1 (arm left / entry side)
    PCA9685 channel 1   →  Servo motor 2 (arm right / exit side)

Servo signal timing (standard hobby servo at 50 Hz):
    Pulse 0.5 ms →  0°   (closed / locked)
    Pulse 1.5 ms → 90°   (half open)
    Pulse 2.5 ms → 180°  (fully open)

    ⚠️  angle_open_deg and angle_closed_deg MUST be tuned on the
        physical hardware before deployment.

Dependencies:
    pip install adafruit-circuitpython-pca9685 adafruit-circuitpython-motor

Authors : Alperen Söylen  (220104004024) — Primary
Date    : 2026-04-11
Version : 0.1

Changelog:
    v0.1 (2026-04-11) — Initial implementation
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

logger = logging.getLogger(__name__)


# =============================================================================
# DATACLASS: GATE CONFIGURATION  (NEW — not in include/)
# =============================================================================

@dataclass
class GateConfig:
    """
    Configuration for the PCA9685-based gate servo controller.

    All angle values are in degrees (0–180).
    Tune angle_open_deg and angle_closed_deg on the physical hardware.
    """
    i2c_address:      int   = 0x40   # PCA9685 I2C address (default, no ADDR jumpers)
    pwm_frequency_hz: int   = 50     # Standard hobby-servo PWM frequency
    channel_arm1:     int   = 0      # PCA9685 channel for servo 1
    channel_arm2:     int   = 1      # PCA9685 channel for servo 2
    angle_open_deg:   int   = 90     # ⚠️ TUNE ON HARDWARE — open / unlock position
    angle_closed_deg: int   = 0      # ⚠️ TUNE ON HARDWARE — closed / locked position
    move_delay_s:     float = 1.0    # Seconds to wait after issuing a move command
    open_duration_s:  float = 5.0    # Seconds the gate stays open before auto-close


# =============================================================================
# CLASS: GATE CONTROLLER  (NEW — not in include/)
# =============================================================================

class GateController:
    """
    Controls two servo motors via a PCA9685 I2C PWM driver board.

    Call init() once before gate_open() / gate_close().
    Call cleanup() on shutdown to zero the PWM signal and release I2C.

    The public API intentionally mirrors the function names specified in
    the MOD-02 C/C++ header (gate_open / gate_close) so the IoT
    orchestrator can call this the same way regardless of implementation.
    """

    def __init__(self, config: GateConfig = None) -> None:
        self._config = config or GateConfig()
        self._pca    = None   # adafruit_pca9685.PCA9685 instance
        self._servo1 = None   # adafruit_motor.servo.Servo for arm 1
        self._servo2 = None   # adafruit_motor.servo.Servo for arm 2

    # -------------------------------------------------------------------------
    # Lifecycle
    # -------------------------------------------------------------------------

    def init(self) -> bool:
        """
        Opens the I2C bus and initialises the PCA9685 + servo objects.

        Returns:
            True on success, False if I2C or the adafruit libs are
            unavailable (e.g. running on a dev machine).
        """
        try:
            import board                              # adafruit blinka
            import busio
            from adafruit_pca9685 import PCA9685
            from adafruit_motor  import servo as servo_lib

            i2c = busio.I2C(board.SCL, board.SDA)
            self._pca = PCA9685(i2c, address=self._config.i2c_address)
            self._pca.frequency = self._config.pwm_frequency_hz

            self._servo1 = servo_lib.Servo(
                self._pca.channels[self._config.channel_arm1]
            )
            self._servo2 = servo_lib.Servo(
                self._pca.channels[self._config.channel_arm2]
            )

            # Start in closed position
            self._set_angle(self._config.angle_closed_deg)
            logger.info(
                "GateController: init OK (I2C addr=0x%02X, ch=%d/%d, "
                "open=%d°, closed=%d°)",
                self._config.i2c_address,
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
        Sets servos to the closed position and releases the PCA9685.
        Safe to call even if init() was not completed successfully.
        """
        if self._pca is not None:
            try:
                self._set_angle(self._config.angle_closed_deg)
                time.sleep(self._config.move_delay_s)
                self._pca.deinit()
                logger.info("GateController: PCA9685 released.")
            except Exception as exc:
                logger.warning("GateController: cleanup warning — %s", exc)
            finally:
                self._pca    = None
                self._servo1 = None
                self._servo2 = None

    # -------------------------------------------------------------------------
    # Public gate API  (mirrors MOD-02 C/C++ function names)
    # -------------------------------------------------------------------------

    def gate_open(self) -> None:
        """
        Rotates both servo arms to the open (unlocked) position.

        Blocks for move_delay_s seconds to allow the servos to reach
        their target angle before the caller proceeds.
        """
        logger.info(
            "GateController: gate_open() → %d°", self._config.angle_open_deg
        )
        self._set_angle(self._config.angle_open_deg)
        time.sleep(self._config.move_delay_s)

    def gate_close(self) -> None:
        """
        Rotates both servo arms back to the closed (locked) position.

        Blocks for move_delay_s seconds to allow the servos to complete
        their travel before the caller proceeds.
        """
        logger.info(
            "GateController: gate_close() → %d°", self._config.angle_closed_deg
        )
        self._set_angle(self._config.angle_closed_deg)
        time.sleep(self._config.move_delay_s)

    # -------------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------------

    def _set_angle(self, angle_deg: int) -> None:
        """
        Sets both servo channels to the given angle simultaneously.

        Args:
            angle_deg: Target angle in degrees (0–180).
        """
        if self._servo1 is None or self._servo2 is None:
            logger.error("GateController: _set_angle() called before init()")
            return
        self._servo1.angle = angle_deg
        self._servo2.angle = angle_deg
