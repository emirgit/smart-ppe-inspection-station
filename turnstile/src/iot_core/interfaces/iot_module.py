"""
iot_module.py
=============
MOD-03 IoT Module — Central Orchestrator Interface

Defines the public interface of the IoT module.
This is the main entry point that runs on the Raspberry Pi and
coordinates all other modules in the access control flow:

  RFID read → backend lookup → AI PPE detection → gate decision → display

The state machine, threading, and hardware wiring are implementation
details hidden behind this interface.

Authors : Alperen Söylen       (220104004024) — Primary
          Zeynep Etik          (220104004035) — Secondary
          Mümincan Durak       (210104004057) — Secondary
          Emre İlhan Şenel    (230104004907) — Secondary
          Hüseyin Elyesa Yeşilyurt (210104004080) — Secondary
Date    : 2026-03-29
Version : 0.1

Changelog:
    v0.1 (2026-03-29) — Initial draft; new file (no prior version)

─────────────────────────────────────────────────────────────
SYSTEM FLOW
─────────────────────────────────────────────────────────────
  IDLE
    │  card scanned (RfidReader.read_card)
    ▼
  IDENTIFYING
    │  backend lookup (BackendClient.get_worker)
    │  unknown card → show_unknown_card → IDLE
    ▼
  INSPECTING
    │  capture frame (caller captures via camera)
    │  AI detection (AIVisionModule.detect(frame))
    │  compare detected vs required PPE
    ▼
  GRANTED                       DENIED
    │  gate_open() [MOD-02]       │  gate stays closed
    │  show_granted() [MOD-05]    │  show_denied(missing) [MOD-05]
    │  log_entry() [MOD-04]       │  log_entry() [MOD-04]
    ▼                             ▼
  IDLE ◄────────────────────────────

─────────────────────────────────────────────────────────────
INTER-MODULE CALLS MADE BY IOT
─────────────────────────────────────────────────────────────
  MOD-01  AIVisionModule.detect(frame)   → DetectionResult
  MOD-02  gate_open() / gate_close()
  MOD-04  BackendClient.get_worker()     → WorkerInfo
  MOD-04  BackendClient.log_entry()
  MOD-05  DisplayClient.show_*()
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import IntEnum
from typing import Optional


# =============================================================================
# ENUM: SYSTEM STATE
# =============================================================================

class SystemState(IntEnum):
    """
    States of the access control flow.

    Transitions:
        IDLE → IDENTIFYING → INSPECTING → GRANTED → IDLE
                           ↘              ↘
                            IDLE          DENIED → IDLE
    """
    IDLE        = 0  # Waiting for RFID card
    IDENTIFYING = 1  # Card read; querying backend for worker info
    INSPECTING  = 2  # Worker identified; running AI PPE detection
    GRANTED     = 3  # All required PPE present; gate opening
    DENIED      = 4  # Required PPE missing or card unknown; gate locked


# =============================================================================
# DATACLASS: IOT MODULE CONFIGURATION
# =============================================================================

@dataclass
class IoTConfig:
    """Configuration parameters for IoTModule.init()."""
    backend_url:       str   = "http://localhost:8000/api"
    display_url:       str   = "http://localhost:3000"
    denied_timeout_ms: int   = 5000   # Time before DENIED resets to IDLE (ms)
    frame_width:       int   = 640    # Camera frame width passed to AI module
    frame_height:      int   = 640    # Camera frame height passed to AI module


# =============================================================================
# ABSTRACT CLASS: IOT MODULE INTERFACE
# =============================================================================

class IoTModule(ABC):
    """
    Abstract interface for the MOD-03 IoT orchestrator.

    One instance runs on the Raspberry Pi for the lifetime of the system.
    The implementation wires together MOD-01, MOD-02, MOD-04, and MOD-05.
    """

    @abstractmethod
    def init(self, config: Optional[IoTConfig] = None) -> bool:
        """
        Initializes all sub-components and verifies hardware connections.

        Must be called once before run().

        Args:
            config: Module configuration. If None, defaults are used.

        Returns:
            True if all components initialized successfully, False otherwise.
        """
        ...

    @abstractmethod
    def run(self) -> None:
        """
        Starts the main access control loop.

        Runs indefinitely until stop() is called or a fatal error occurs.
        Each iteration processes one state transition of the flow.
        """
        ...

    @abstractmethod
    def stop(self) -> None:
        """
        Signals the main loop to exit and releases all resources.

        Ensures the gate is closed and all hardware is safely shut down
        before returning.
        """
        ...

    @abstractmethod
    def get_state(self) -> SystemState:
        """
        Returns the current system state.

        Returns:
            Current SystemState value.
        """
        ...
