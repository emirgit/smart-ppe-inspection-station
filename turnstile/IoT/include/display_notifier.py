"""
display_notifier.py
===================
MOD-03 IoT Module — Display Notifier Interface (rich, push-based)

Defines the abstract interface used by the IoT orchestrator to push
*structured* state events to MOD-05 (UI/UX — Turnstile Display).

This complements the existing :class:`DisplayClient` (which only
exposes thin imperative ``show_*`` calls) by carrying the full payload
that the React turnstile display needs in order to render rich screens
(worker identity, required/detected/missing PPE items, instruction
text, etc.).

Rationale
---------
``DisplayClient`` was designed before the MOD-05 contract was finalised
and only carries strings (``worker_name``, ``missing_ppe: list[str]``).
The React display, however, expects a richer payload per the MOD-05
``display_interface.d.ts`` schema:

    {
      "state": "INSPECTING",
      "worker": { "id", "full_name", "role_name", "photo_url" },
      "required_ppe": [ {"id","item_key","display_name","icon_name"} ],
      ...
    }

Rather than break the existing ``DisplayClient`` interface (and its
mock implementation, which is exercised by the unit tests), this module
introduces a separate, optional notifier that the orchestrator can call
in addition to the legacy ``show_*`` methods.

The transport (WebSocket / HTTP / no-op mock) is hidden behind the
abstract interface; concrete implementations live under ``impl/`` and
``mock/``.

Authors : Emre İlhan Şenel    (230104004907) — Primary
          Alperen Söylen       (220104004024) — Reviewer
Date    : 2026-04-17
Version : 0.1

Changelog:
    v0.1 (2026-04-17) — Initial draft; new file (no prior version).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from .models import RequiredPpeItem, WorkerInfo


# =============================================================================
# ABSTRACT CLASS: DISPLAY NOTIFIER INTERFACE
# =============================================================================

class DisplayNotifier(ABC):
    """
    Abstract interface for pushing rich state events to MOD-05.

    Each method corresponds to one terminal or transient state of the
    IoT state machine.  Implementations are expected to serialise the
    payload to JSON and push it over their chosen transport (a
    WebSocket broadcast in production, an in-memory log in tests).

    All methods are optional from the orchestrator's perspective:
    ``IoTOrchestrator`` will only call them when a notifier is wired
    in, so existing deployments that have no notifier configured keep
    working unchanged.

    Lifecycle
    ---------
    Implementations may need to spin up background resources
    (event loops, sockets).  ``start()`` is invoked once during
    ``IoTOrchestrator.init()``; ``stop()`` is invoked once during
    ``IoTOrchestrator.stop()``.  Implementations that have no
    background work to do may leave both as no-ops.
    """

    # -------------------------------------------------------------------------
    # Lifecycle
    # -------------------------------------------------------------------------

    @abstractmethod
    def start(self) -> None:
        """
        Starts any background resources (e.g. WebSocket server).

        Called once during :meth:`IoTModule.init`.  Must be idempotent;
        a second call after ``stop()`` should re-start the resource.
        """
        ...

    @abstractmethod
    def stop(self) -> None:
        """
        Releases any background resources.

        Called once during :meth:`IoTModule.stop`.  Must be safe to
        call even if :meth:`start` was never called.
        """
        ...

    # -------------------------------------------------------------------------
    # State notifications (one per orchestrator state transition)
    # -------------------------------------------------------------------------

    @abstractmethod
    def notify_idle(self) -> None:
        """
        Notifies the display that the system has returned to IDLE.

        Sent at boot, after every cycle completes, and after a terminal
        state's local timeout elapses.
        """
        ...

    @abstractmethod
    def notify_identifying(self, rfid_card_uid: str) -> None:
        """
        Notifies the display that an RFID card was scanned and is being
        looked up against the backend.

        Args:
            rfid_card_uid: The hex UID returned by ``RfidReader.read_card``.
        """
        ...

    @abstractmethod
    def notify_unknown_card(self, rfid_card_uid: str) -> None:
        """
        Notifies the display that the scanned card is not registered.

        The display renders its own dedicated screen for this state and
        auto-returns to IDLE after a local timeout.

        Args:
            rfid_card_uid: The hex UID that was rejected.
        """
        ...

    @abstractmethod
    def notify_inspecting(
        self,
        worker:        WorkerInfo,
        required_ppe:  list[RequiredPpeItem],
        instruction:   Optional[str] = None,
    ) -> None:
        """
        Notifies the display that PPE inspection has started.

        Args:
            worker: The identified worker (full :class:`WorkerInfo`).
            required_ppe: The PPE items the worker must wear, in the
                order they should appear on screen.
            instruction: Optional human-readable instruction shown on
                the display (e.g. "Please face the camera and raise
                your hands").  When ``None``, the display falls back
                to its built-in default.
        """
        ...

    @abstractmethod
    def notify_pass(
        self,
        worker:        WorkerInfo,
        detected_ppe:  list[RequiredPpeItem],
    ) -> None:
        """
        Notifies the display that access was granted.

        Args:
            worker: The identified worker.
            detected_ppe: The PPE items that were detected (typically
                the full required list when access is granted).
        """
        ...

    @abstractmethod
    def notify_fail(
        self,
        worker:        WorkerInfo,
        detected_ppe:  list[RequiredPpeItem],
        missing_ppe:   list[RequiredPpeItem],
    ) -> None:
        """
        Notifies the display that access was denied due to missing PPE.

        Args:
            worker: The identified worker.
            detected_ppe: PPE items the AI did detect.
            missing_ppe: PPE items the AI did NOT detect (still
                required).  Carried as full :class:`RequiredPpeItem`
                instances so the display can show ``display_name`` and
                ``icon_name`` rather than bare ``item_key`` strings.
        """
        ...
