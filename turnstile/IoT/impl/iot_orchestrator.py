"""
iot_orchestrator.py
===================
MOD-03 IoT Module — Main State Machine Implementation

Concrete implementation of IoTModule.  Wires together all sub-modules
and runs the access control state machine loop:

    IDLE → IDENTIFYING → INSPECTING → GRANTED / DENIED → IDLE

Inter-module calls:
    MOD-01  ai.detect(frame)           → DetectionResult
    MOD-02  gate.gate_open()
            gate.gate_close()
    MOD-04  backend.get_worker()       → WorkerInfo
            backend.log_entry()
    MOD-05  display.show_*()           (WebSocket, filled in later)

⚠️  NEW __init__ parameters (not defined in IoTModule ABC):
        gate   : GateController      — servo gate driver
        ai     : AIVisionModule      — MOD-01 inference wrapper
        camera_device : int = 0      — OpenCV VideoCapture device index

⚠️  TODO (MOD-01 integration):
        DetectionResult field name not yet confirmed with Zeynep's team.
        See the marked TODO block inside _run_inspection().

Authors : Alperen Söylen  (220104004024) — Primary
Date    : 2026-04-11
Version : 0.1

Changelog:
    v0.1 (2026-04-11) — Initial implementation
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Optional, TYPE_CHECKING

import cv2

from ..include.iot_module    import IoTModule, IoTConfig, SystemState
from ..include.rfid_reader   import RfidReader
from ..include.backend_client import BackendClient
from ..include.display_client import DisplayClient
from ..include.models        import EntryLog, AccessDecision, WorkerInfo, DetectionItem
from .gate_control           import GateController

if TYPE_CHECKING:
    # Imported only for type hints; avoids hard dependency at module load time.
    # The real import is done dynamically inside _init_ai().
    from app.include.ai_vision_module import AIVisionModule  # type: ignore

logger = logging.getLogger(__name__)


class IoTOrchestrator(IoTModule):
    """
    Runs the full PPE inspection state machine on the Raspberry Pi.

    Constructor injects all hardware/network dependencies so that mocks
    can be swapped in during development without touching this class.

    Args:
        rfid          : RfidReader implementation (SPI or WiFi).
        backend       : BackendClient implementation (HTTP or mock).
        display       : DisplayClient implementation (WebSocket or mock).
        gate          : GateController for the servo-driven turnstile gate.
        ai            : AIVisionModule for PPE detection (MOD-01).
        camera_device : OpenCV VideoCapture device index (default 0).
    """

    def __init__(
        self,
        rfid:          RfidReader,
        backend:       BackendClient,
        display:       DisplayClient,
        gate:          GateController,
        ai:            "AIVisionModule",
        camera_device: int = 0,
    ) -> None:
        self._rfid          = rfid
        self._backend       = backend
        self._display       = display
        self._gate          = gate
        self._ai            = ai
        self._camera_device = camera_device

        self._config:  IoTConfig    = IoTConfig()
        self._state:   SystemState  = SystemState.IDLE
        self._state_lock            = threading.Lock()

        self._running: bool         = False
        self._stop_event            = threading.Event()
        self._cap:    Optional[cv2.VideoCapture] = None   # camera handle

    # =========================================================================
    # IoTModule interface
    # =========================================================================

    def init(self, config: Optional[IoTConfig] = None) -> bool:
        """
        Initialises all sub-components and the camera.

        Must be called once before run().

        Args:
            config: IoTModule configuration (URLs, timeouts, frame size).
                    Defaults are used if None.

        Returns:
            True if all components initialise successfully.
        """
        self._config = config or IoTConfig()

        # -- RFID reader -----------------------------------------------------
        if not self._rfid.init():
            logger.error("init: RfidReader.init() failed")
            return False

        # -- Gate controller -------------------------------------------------
        if not self._gate.init():
            logger.error("init: GateController.init() failed")
            return False

        # -- Camera ----------------------------------------------------------
        self._cap = cv2.VideoCapture(self._camera_device)
        if not self._cap.isOpened():
            logger.error("init: cannot open camera device %d", self._camera_device)
            return False

        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH,  self._config.frame_width)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self._config.frame_height)

        logger.info(
            "init: camera device=%d resolution=%dx%d",
            self._camera_device,
            self._config.frame_width,
            self._config.frame_height,
        )

        # -- Display: show initial idle screen -------------------------------
        self._display.show_idle()
        self._set_state(SystemState.IDLE)

        logger.info("IoTOrchestrator: all components initialised OK")
        return True

    def run(self) -> None:
        """
        Starts the main access control loop.  Blocks until stop() is called.

        Each iteration processes one full inspection cycle:
            IDLE → IDENTIFYING → INSPECTING → GRANTED/DENIED → IDLE
        """
        self._running = True
        self._stop_event.clear()
        logger.info("IoTOrchestrator: run() started")

        while not self._stop_event.is_set():
            try:
                self._cycle()
            except Exception as exc:
                logger.exception("IoTOrchestrator: unhandled error in cycle — %s", exc)
                time.sleep(1.0)   # brief pause before retrying

        logger.info("IoTOrchestrator: run() exited")

    def stop(self) -> None:
        """
        Signals run() to exit, closes the gate, and releases all resources.
        """
        logger.info("IoTOrchestrator: stop() called")
        self._stop_event.set()
        self._running = False

        # Close gate to a safe state
        try:
            self._gate.gate_close()
        except Exception as exc:
            logger.warning("stop: gate_close() error — %s", exc)

        # Release camera
        if self._cap and self._cap.isOpened():
            self._cap.release()
            self._cap = None

        self._rfid.cleanup()
        self._gate.cleanup()
        logger.info("IoTOrchestrator: all resources released")

    def get_state(self) -> SystemState:
        """Returns the current system state (thread-safe)."""
        with self._state_lock:
            return self._state

    # =========================================================================
    # Internal: one inspection cycle
    # =========================================================================

    def _cycle(self) -> None:
        """
        Runs one complete access control cycle:
            IDLE → IDENTIFYING → INSPECTING → GRANTED / DENIED → IDLE
        """
        # ── IDLE: wait for card ──────────────────────────────────────────────
        self._set_state(SystemState.IDLE)
        self._display.show_idle()

        card_id = self._rfid.read_card(timeout_ms=self._config.denied_timeout_ms)
        if card_id is None or self._stop_event.is_set():
            return   # timeout or stop requested

        logger.info("_cycle: card scanned — %s", card_id)

        # ── IDENTIFYING: query backend ───────────────────────────────────────
        self._set_state(SystemState.IDENTIFYING)
        worker: Optional[WorkerInfo] = self._backend.get_worker(card_id)

        if worker is None:
            logger.info("_cycle: unknown card — %s", card_id)
            self._backend.log_entry(EntryLog(
                card_id=card_id,
                worker_id=None,
                decision=AccessDecision.UNKNOWN_CARD,
                timestamp_ms=self._now_ms(),
                detections=[]
            ))
            self._display.show_unknown_card()
            self._set_state(SystemState.DENIED)
            time.sleep(self._config.denied_timeout_ms / 1000.0)
            return

        # extract item_key strings for easier manipulation internally
        required_ppe_keys = [p.item_key for p in worker.required_ppe]
        
        logger.info(
            "_cycle: identified — %s (%s) required PPE: %s",
            worker.worker_name, worker.role, required_ppe_keys
        )

        # ── INSPECTING: capture frame + run AI ──────────────────────────────
        self._set_state(SystemState.INSPECTING)
        self._display.show_scanning()

        detected_ppe: list[str] = self._run_inspection()

        missing_ppe: list[str] = [
            item for item in required_ppe_keys
            if item not in detected_ppe
        ]

        logger.info(
            "_cycle: detected=%s  missing=%s", detected_ppe, missing_ppe
        )

        # ── DECISION ────────────────────────────────────────────────────────
        if not missing_ppe:
            self._grant_access(worker, card_id, detected_ppe)
        else:
            self._deny_access(worker, card_id, detected_ppe, missing_ppe)

    # =========================================================================
    # Internal: AI inference
    # =========================================================================

    def _run_inspection(self) -> list[str]:
        """
        Captures one camera frame and runs MOD-01 AI PPE detection.

        Returns:
            List of detected PPE item_key strings (e.g. ["HELMET", "VEST"]).
            Returns an empty list if the camera or AI fails.
        """
        if self._cap is None or not self._cap.isOpened():
            logger.error("_run_inspection: camera not available")
            return []

        ret, frame = self._cap.read()
        if not ret or frame is None:
            logger.error("_run_inspection: failed to capture frame from camera")
            return []

        try:
            result = self._ai.detect(frame)

            # ──────────────────────────────────────────────────────────────
            # TODO — VERIFY WITH MOD-01 TEAM (Zeynep)
            # DetectionResult field name for the detected PPE class labels
            # is not yet confirmed.  Adjust the attribute access below once
            # MOD-01 publishes their DetectionResult definition.
            #
            # Expected: result gives a list[str] of PPE item_key values
            # that match those returned by MOD-04 (e.g. "HELMET", "VEST").
            #
            # Candidate attributes to try (pick the correct one):
            #   result.labels
            #   result.detected_labels
            #   result.detected_classes
            #   [item.label for item in result.detections]
            # ──────────────────────────────────────────────────────────────
            detected_ppe: list[str] = result.labels   # ← CHANGE IF NEEDED

            logger.info("_run_inspection: AI detected — %s", detected_ppe)
            return detected_ppe

        except Exception as exc:
            logger.error("_run_inspection: AI detection failed — %s", exc)
            return []

    # =========================================================================
    # Internal: grant / deny helpers
    # =========================================================================

    def _grant_access(
        self,
        worker:       WorkerInfo,
        card_id:      str,
        detected_ppe: list[str],
    ) -> None:
        """Opens the gate and logs a PASS decision."""
        self._set_state(SystemState.GRANTED)
        logger.info("_grant_access: PASS — %s", worker.worker_name)

        self._display.show_granted(worker.worker_name)
        self._gate.gate_open()
        
        # Build detections list
        detections = []
        for ppe_item in worker.required_ppe:
            was_detected = ppe_item.item_key in detected_ppe
            detections.append(DetectionItem(
                ppe_item_id=ppe_item.id,
                was_required=True,
                was_detected=was_detected,
                confidence=0.99  # Mocked or retrieved from AI result
            ))

        self._backend.log_entry(EntryLog(
            card_id=card_id,
            worker_id=worker.worker_id,
            decision=AccessDecision.PASS,
            detected_ppe=detected_ppe,
            missing_ppe=[],
            detections=detections,
            timestamp_ms=self._now_ms(),
        ))

        # Keep gate open for the configured duration, then close
        time.sleep(self._gate._config.open_duration_s)
        self._gate.gate_close()

    def _deny_access(
        self,
        worker:       WorkerInfo,
        card_id:      str,
        detected_ppe: list[str],
        missing_ppe:  list[str],
    ) -> None:
        """Keeps gate closed and logs a FAIL decision."""
        self._set_state(SystemState.DENIED)
        logger.info(
            "_deny_access: FAIL — %s, missing: %s", worker.worker_name, missing_ppe
        )

        self._display.show_denied(missing_ppe)
        
        # Build detections list
        detections = []
        for ppe_item in worker.required_ppe:
            was_detected = ppe_item.item_key in detected_ppe
            detections.append(DetectionItem(
                ppe_item_id=ppe_item.id,
                was_required=True,
                was_detected=was_detected,
                confidence=0.99  # Mocked or retrieved from AI result
            ))

        self._backend.log_entry(EntryLog(
            card_id=card_id,
            worker_id=worker.worker_id,
            decision=AccessDecision.FAIL,
            detected_ppe=detected_ppe,
            missing_ppe=missing_ppe,
            detections=detections,
            timestamp_ms=self._now_ms(),
        ))

        time.sleep(self._config.denied_timeout_ms / 1000.0)

    # =========================================================================
    # Internal: utilities
    # =========================================================================

    def _set_state(self, state: SystemState) -> None:
        with self._state_lock:
            self._state = state
        logger.debug("State → %s", state.name)

    @staticmethod
    def _now_ms() -> int:
        """Returns the current Unix timestamp in milliseconds."""
        return int(time.time() * 1000)
