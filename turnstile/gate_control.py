import logging
import time
from adafruit_servokit import ServoKit

logger = logging.getLogger(__name__)

class Turnstile:
    """
    Abstraction of the hardware turnstile gate system.
    Manages two servos via PCA9685 to control entry and exit passage.
    """
    
    # --- Constants & Configuration ---
    GATE_ENTRY_SERVO_CHANNEL = 0
    GATE_EXIT_SERVO_CHANNEL = 1

    GATE_ANGLE_CLOSED_DEG = 90
    GATE_ENTRY_ANGLE_DEG = 180
    GATE_EXIT_ANGLE_DEG = 0

    GATE_SWEEP_DURATION_MS = 350
    GATE_AUTO_CLOSE_DELAY_MS = 5000

    # Direction Constants
    DIR_ENTRY = "ENTRY"
    DIR_EXIT = "EXIT"

    def __init__(self, channels=16):
        """Initializes the ServoKit and sets the gate to the closed position."""
        try:
            self.kit = ServoKit(channels=channels)
            self.pca9685_available = True
            logger.info("Turnstile: Adafruit ServoKit (PCA9685) initialized.")
        except Exception as e:
            logger.error(f"Turnstile: Error initializing ServoKit: {e}")
            self.pca9685_available = False
        
        # Ensure gate starts in closed position
        self.gate_close()

    def _set_angle(self, channel, angle):
        """Internal helper to set servo angle with safety checks."""
        if not self.pca9685_available:
            return
        try:
            # Ensure angle is within 0-180 range
            angle = max(0, min(180, angle))
            self.kit.servo[channel].angle = angle
        except Exception as e:
            logger.error(f"Turnstile: Error setting servo CH{channel} to {angle}°: {e}")

    def gate_open(self, direction):
        """
        Opens the gate in the specified direction.
        - ENTRY: Entry Servo -> 180, Exit Servo -> 0
        - EXIT:  Entry Servo -> 0,   Exit Servo -> 180
        """
        if direction == self.DIR_ENTRY:
            logger.info(f"Turnstile: Opening for {direction}...")
            self._set_angle(self.GATE_ENTRY_SERVO_CHANNEL, self.GATE_ENTRY_ANGLE_DEG)
            self._set_angle(self.GATE_EXIT_SERVO_CHANNEL, self.GATE_EXIT_ANGLE_DEG)
        elif direction == self.DIR_EXIT:
            logger.info(f"Turnstile: Opening for {direction}...")
            self._set_angle(self.GATE_ENTRY_SERVO_CHANNEL, self.GATE_EXIT_ANGLE_DEG)
            self._set_angle(self.GATE_EXIT_SERVO_CHANNEL, self.GATE_ENTRY_ANGLE_DEG)
        else:
            logger.warning(f"Turnstile: Unknown direction: {direction}")
            return

        # Blocking wait for sweep, then hold open, then auto-close
        time.sleep(self.GATE_SWEEP_DURATION_MS / 1000.0)
        time.sleep(self.GATE_AUTO_CLOSE_DELAY_MS / 1000.0)
        self.gate_close()

    def gate_close(self):
        """Returns both servos to the closed position (90 degrees)."""
        logger.info("Turnstile: Closing gate...")
        self._set_angle(self.GATE_ENTRY_SERVO_CHANNEL, self.GATE_ANGLE_CLOSED_DEG)
        self._set_angle(self.GATE_EXIT_SERVO_CHANNEL, self.GATE_ANGLE_CLOSED_DEG)
        
        # Blocking wait for sweep duration
        time.sleep(self.GATE_SWEEP_DURATION_MS / 1000.0)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    # OOP Test Sequence
    turnstile = Turnstile()

    if turnstile.pca9685_available:
        logger.info("--- Starting Turnstile OOP Test ---")

        logger.info("Testing Entry...")
        turnstile.gate_open(Turnstile.DIR_ENTRY)

        logger.info("Testing Exit...")
        turnstile.gate_open(Turnstile.DIR_EXIT)

        logger.info("--- Test Complete ---")
    else:
        logger.warning("PCA9685 not available, skipping hardware test.")
