"""
Tests for the display notifier bridge:

  * payload builder helpers (pure JSON shape, no I/O)
  * MockDisplayNotifier capture semantics
  * IoTOrchestrator notifier wiring (additive, optional)
  * WebSocketDisplayNotifier real round-trip over loopback
"""
from __future__ import annotations

import asyncio
import json
import socket
import time
from contextlib import closing
from unittest.mock import MagicMock, patch

import pytest

from turnstile.IoT.impl.iot_orchestrator import IoTOrchestrator
from turnstile.IoT.impl.websocket_display_notifier import (
    DEFAULT_INSPECTING_INSTRUCTION,
    WebSocketDisplayNotifier,
    _build_payload,
    _serialise_ppe,
    _serialise_worker,
)
from turnstile.IoT.include.iot_module import IoTConfig, SystemState
from turnstile.IoT.include.models import (
    AccessDecision,
    RequiredPpeItem,
    WorkerInfo,
)
from turnstile.IoT.mock.mock_display_notifier import MockDisplayNotifier


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def sample_worker() -> WorkerInfo:
    return WorkerInfo(
        worker_id=1,
        worker_name="Ahmet Yılmaz",
        role="Technician",
        required_ppe=[
            RequiredPpeItem(1, "hard_hat",   "Hard Hat",   "hard_hat"),
            RequiredPpeItem(2, "safety_vest", "Safety Vest", "safety_vest"),
        ],
    )


@pytest.fixture
def thin_worker() -> WorkerInfo:
    """Worker whose PPE items omit display_name/icon_name to test fallbacks."""
    return WorkerInfo(
        worker_id=3,
        worker_name="Mehmet Kaya",
        role="Construction Worker",
        required_ppe=[RequiredPpeItem(1, "HELMET")],
    )


def _free_port() -> int:
    """Allocates a free TCP port to keep parallel test runs isolated."""
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


# =============================================================================
# Payload helpers
# =============================================================================

class TestPayloadHelpers:
    """`_build_payload`, `_serialise_worker`, `_serialise_ppe` are the
    single source of truth for the wire contract; lock the JSON shape
    down here so accidental drift breaks a focused test."""

    def test_serialise_worker_remaps_field_names(self, sample_worker):
        out = _serialise_worker(sample_worker)
        assert out == {
            "id":         1,
            "full_name":  "Ahmet Yılmaz",
            "role_name":  "Technician",
            "photo_url":  None,
        }

    def test_serialise_ppe_falls_back_to_item_key(self, thin_worker):
        out = _serialise_ppe(thin_worker.required_ppe)
        assert out == [{
            "id":           1,
            "item_key":     "HELMET",
            "display_name": "HELMET",
            "icon_name":    "HELMET",
        }]

    def test_build_payload_idle_is_minimal(self):
        assert _build_payload("IDLE") == {"state": "IDLE"}

    def test_build_payload_inspecting_includes_worker_and_ppe(
        self, sample_worker
    ):
        payload = _build_payload(
            "INSPECTING",
            worker=sample_worker,
            required_ppe=sample_worker.required_ppe,
            instruction="Look at the camera",
        )
        assert payload["state"] == "INSPECTING"
        assert payload["worker"]["full_name"] == "Ahmet Yılmaz"
        assert [p["item_key"] for p in payload["required_ppe"]] == [
            "hard_hat", "safety_vest",
        ]
        assert payload["instruction"] == "Look at the camera"
        assert "detected_ppe" not in payload
        assert "missing_ppe" not in payload

    def test_build_payload_pass_carries_only_detected(self, sample_worker):
        payload = _build_payload(
            "PASS",
            worker=sample_worker,
            detected_ppe=sample_worker.required_ppe,
        )
        assert payload["state"] == "PASS"
        assert payload["worker"]["id"] == 1
        assert "detected_ppe" in payload
        assert "missing_ppe" not in payload

    def test_build_payload_fail_carries_detected_and_missing(self, sample_worker):
        payload = _build_payload(
            "FAIL",
            worker=sample_worker,
            detected_ppe=[sample_worker.required_ppe[0]],
            missing_ppe=[sample_worker.required_ppe[1]],
        )
        assert payload["state"] == "FAIL"
        assert [p["item_key"] for p in payload["detected_ppe"]] == ["hard_hat"]
        assert [p["item_key"] for p in payload["missing_ppe"]] == ["safety_vest"]

    def test_build_payload_unknown_card_carries_uid(self):
        payload = _build_payload("UNKNOWN_CARD", rfid_card_uid="A3F2C1D4")
        assert payload == {
            "state": "UNKNOWN_CARD",
            "rfid_card_uid": "A3F2C1D4",
        }


# =============================================================================
# MockDisplayNotifier
# =============================================================================

class TestMockDisplayNotifier:

    def test_records_events_in_order(self, sample_worker):
        notifier = MockDisplayNotifier()
        notifier.notify_idle()
        notifier.notify_identifying("UID1")
        notifier.notify_inspecting(sample_worker, sample_worker.required_ppe)
        notifier.notify_pass(sample_worker, sample_worker.required_ppe)

        assert notifier.states() == ["IDLE", "IDENTIFYING", "INSPECTING", "PASS"]

    def test_inspecting_event_captures_worker_and_required(self, sample_worker):
        notifier = MockDisplayNotifier()
        notifier.notify_inspecting(sample_worker, sample_worker.required_ppe)
        state, kwargs = notifier.events[-1]
        assert state == "INSPECTING"
        assert kwargs["worker"] is sample_worker
        # Notifier stores its own copy of the list to avoid aliasing surprises.
        assert kwargs["required_ppe"] == sample_worker.required_ppe
        assert kwargs["required_ppe"] is not sample_worker.required_ppe

    def test_lifecycle_flag_toggles(self):
        notifier = MockDisplayNotifier()
        assert notifier.started is False
        notifier.start()
        assert notifier.started is True
        notifier.stop()
        assert notifier.started is False


# =============================================================================
# Orchestrator wiring
# =============================================================================

@pytest.fixture
def orchestrator_with_notifier(mock_gate_controller, mock_ai_vision):
    """Orchestrator with a MockDisplayNotifier installed."""
    rfid    = MagicMock()
    backend = MagicMock()
    display = MagicMock()
    notifier = MockDisplayNotifier()

    with patch("turnstile.IoT.impl.iot_orchestrator.cv2.VideoCapture") as mock_cv2:
        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = True
        mock_cap.read.return_value = (True, "fake_frame")
        mock_cv2.return_value = mock_cap

        orch = IoTOrchestrator(
            rfid=rfid,
            backend=backend,
            display=display,
            gate=mock_gate_controller,
            ai=mock_ai_vision,
            notifier=notifier,
        )
        orch.init(IoTConfig(denied_timeout_ms=10))
        return orch, notifier


class TestOrchestratorNotifierWiring:

    def test_init_starts_notifier_and_emits_idle(self, orchestrator_with_notifier):
        _orch, notifier = orchestrator_with_notifier
        assert notifier.started is True
        # The first event after init() must be IDLE so the display
        # leaves any stale screen from a previous run.
        assert notifier.states()[:1] == ["IDLE"]

    def test_grant_cycle_emits_identifying_inspecting_pass(
        self, orchestrator_with_notifier, sample_worker
    ):
        orch, notifier = orchestrator_with_notifier
        notifier.reset()
        orch._rfid.read_card.return_value = "VALID"
        orch._backend.get_worker.return_value = sample_worker
        orch._ai.detect.return_value = MagicMock(labels=["hard_hat", "safety_vest"])

        orch._cycle()

        # Order matters; the display state machine asserts on order too.
        assert notifier.states() == [
            "IDLE", "IDENTIFYING", "INSPECTING", "PASS",
        ]
        # PASS event must carry the rich detected items, not bare strings.
        pass_state, pass_kwargs = notifier.events[-1]
        detected_keys = [p.item_key for p in pass_kwargs["detected_ppe"]]
        assert detected_keys == ["hard_hat", "safety_vest"]

    def test_deny_cycle_emits_fail_with_missing_items(
        self, orchestrator_with_notifier, sample_worker
    ):
        orch, notifier = orchestrator_with_notifier
        notifier.reset()
        orch._rfid.read_card.return_value = "VALID"
        orch._backend.get_worker.return_value = sample_worker
        orch._ai.detect.return_value = MagicMock(labels=["hard_hat"])

        orch._cycle()

        assert notifier.states()[-1] == "FAIL"
        _state, kwargs = notifier.events[-1]
        assert [p.item_key for p in kwargs["detected_ppe"]] == ["hard_hat"]
        assert [p.item_key for p in kwargs["missing_ppe"]] == ["safety_vest"]

    def test_unknown_card_cycle_emits_unknown_card_state(
        self, orchestrator_with_notifier
    ):
        orch, notifier = orchestrator_with_notifier
        notifier.reset()
        orch._rfid.read_card.return_value = "GHOST"
        orch._backend.get_worker.return_value = None

        orch._cycle()

        # UNKNOWN_CARD must be its own bus event, not piggybacked on FAIL.
        assert "UNKNOWN_CARD" in notifier.states()
        assert orch.get_state() == SystemState.UNKNOWN_CARD
        _state, kwargs = [
            e for e in notifier.events if e[0] == "UNKNOWN_CARD"
        ][-1]
        assert kwargs["rfid_card_uid"] == "GHOST"
        # Backend audit still records UNKNOWN_CARD (regression check).
        log_arg = orch._backend.log_entry.call_args[0][0]
        assert log_arg.decision == AccessDecision.UNKNOWN_CARD

    def test_notifier_failure_does_not_break_cycle(
        self, mock_gate_controller, mock_ai_vision, sample_worker
    ):
        """A misbehaving notifier must not crash the access-control loop."""
        rfid    = MagicMock(); rfid.read_card.return_value = "VALID"
        backend = MagicMock(); backend.get_worker.return_value = sample_worker
        display = MagicMock()
        # Make the AI report exactly what the worker requires so the cycle
        # would normally take the GRANTED branch; the notifier explosion
        # below must not change that outcome.
        mock_ai_vision.detect.return_value = MagicMock(
            labels=["hard_hat", "safety_vest"],
        )
        bad = MagicMock()
        bad.notify_idle.side_effect        = RuntimeError("boom")
        bad.notify_identifying.side_effect = RuntimeError("boom")
        bad.notify_inspecting.side_effect  = RuntimeError("boom")
        bad.notify_pass.side_effect        = RuntimeError("boom")
        bad.notify_fail.side_effect        = RuntimeError("boom")
        bad.notify_unknown_card.side_effect = RuntimeError("boom")

        with patch("turnstile.IoT.impl.iot_orchestrator.cv2.VideoCapture") as mock_cv2:
            mock_cap = MagicMock()
            mock_cap.isOpened.return_value = True
            mock_cap.read.return_value = (True, "fake_frame")
            mock_cv2.return_value = mock_cap

            orch = IoTOrchestrator(
                rfid=rfid, backend=backend, display=display,
                gate=mock_gate_controller, ai=mock_ai_vision,
                notifier=bad,
            )
            orch.init(IoTConfig(denied_timeout_ms=10))
            # Must not raise even though every notifier call explodes.
            orch._cycle()

        # Gate logic still executed.
        assert mock_gate_controller.gate_open.called


# =============================================================================
# WebSocketDisplayNotifier — real loopback round-trip
# =============================================================================

@pytest.mark.asyncio
async def test_websocket_notifier_round_trip(sample_worker):
    """
    Boots a real WebSocketDisplayNotifier on a free port, connects a
    websockets client, asserts the cached payload is replayed on
    connect, and that a fresh notify_inspecting() is delivered.
    """
    websockets = pytest.importorskip("websockets")

    port = _free_port()
    notifier = WebSocketDisplayNotifier(host="127.0.0.1", port=port)
    notifier.start()
    try:
        # Cache one payload BEFORE the client connects; the server must
        # replay it on connect (initial sync requirement).
        notifier.notify_idle()
        # Allow the loop thread to absorb the broadcast.
        await asyncio.sleep(0.05)

        async with websockets.connect(
            f"ws://127.0.0.1:{port}/ws/display",
        ) as client:
            replayed = json.loads(await asyncio.wait_for(client.recv(), timeout=2.0))
            assert replayed["state"] == "IDLE"

            # New transition while the client is connected.
            notifier.notify_inspecting(
                sample_worker, sample_worker.required_ppe,
            )
            live = json.loads(await asyncio.wait_for(client.recv(), timeout=2.0))
            assert live["state"] == "INSPECTING"
            assert live["worker"]["full_name"] == "Ahmet Yılmaz"
            assert live["instruction"] == DEFAULT_INSPECTING_INSTRUCTION

            # DISPLAY_ACK is logged but does not block / error.
            await client.send(json.dumps({
                "type":  "DISPLAY_ACK",
                "state": "INSPECTING",
                "timestamp": "2026-04-17T12:00:00Z",
            }))
            await asyncio.sleep(0.05)
    finally:
        notifier.stop()


@pytest.mark.asyncio
async def test_websocket_notifier_rejects_unexpected_path():
    """A client that connects to the wrong path is closed cleanly."""
    websockets = pytest.importorskip("websockets")

    port = _free_port()
    notifier = WebSocketDisplayNotifier(host="127.0.0.1", port=port)
    notifier.start()
    try:
        with pytest.raises(websockets.ConnectionClosed):
            async with websockets.connect(
                f"ws://127.0.0.1:{port}/wrong/path",
            ) as client:
                # Server should close immediately; .recv() raises.
                await asyncio.wait_for(client.recv(), timeout=2.0)
    finally:
        notifier.stop()
