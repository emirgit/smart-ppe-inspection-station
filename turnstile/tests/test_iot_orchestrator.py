"""
Test suite for IoTOrchestrator state machine logic.
"""
import pytest
from unittest.mock import MagicMock, patch

import numpy as np

from src.iot_core.orchestrator import IoTOrchestrator
from src.iot_core.interfaces.iot_module import IoTConfig
from src.iot_core.models import WorkerInfo, RequiredPpeItem, AccessDecision
from ai_vision.include.module_ai_vision import (
    DetectionResult,
    PPEDetection,
    PPEClass,
)


def _det(cls: PPEClass, conf: float = 0.9) -> PPEDetection:
    return PPEDetection(cls, conf, 0.5, 0.5, 0.4, 0.4)


@pytest.fixture
def orchestrator(mock_gate_controller, mock_ai_vision):
    """Returns an IoTOrchestrator with all external collaborators mocked."""
    rfid = MagicMock()
    backend = MagicMock()
    display = MagicMock()

    with patch("src.iot_core.orchestrator.cv2") as mock_cv2:
        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = True
        # Return a real-ish RGB frame so _run_inspection's cvtColor path works.
        fake_frame = np.zeros((10, 10, 3), dtype=np.uint8)
        mock_cap.read.return_value = (True, fake_frame)
        mock_cv2.VideoCapture.return_value = mock_cap
        mock_cv2.cvtColor.return_value = fake_frame
        mock_cv2.COLOR_BGR2RGB = 0

        orch = IoTOrchestrator(
            rfid=rfid,
            backend=backend,
            display=display,
            gate=mock_gate_controller,
            ai=mock_ai_vision,
        )

        config = IoTConfig(denied_timeout_ms=10)
        orch.init(config)
        return orch


def test_cycle_grant_access(orchestrator):
    """Worker wearing all required PPE: gate opens and PASS is logged."""
    orchestrator._rfid.read_card.return_value = "VALID_CARD"
    worker = WorkerInfo(1, "Alperen Söylen", "Developer", [RequiredPpeItem(1, "HELMET")])
    orchestrator._backend.get_worker.return_value = worker

    orchestrator._cycle()

    orchestrator._gate.gate_open.assert_called_once()
    orchestrator._display.notify_pass.assert_called_once()
    # Real worker payload, not a placeholder.
    assert orchestrator._display.notify_pass.call_args[0][0] is worker

    log_arg = orchestrator._backend.log_entry.call_args[0][0]
    assert log_arg.decision == AccessDecision.PASS
    # Real confidence preserved (mock_ai_vision sets HELMET=0.91).
    helmet_det = next(d for d in log_arg.detections if d.ppe_item_id == 1)
    assert helmet_det.was_detected is True
    assert helmet_det.confidence == pytest.approx(0.91, abs=1e-3)


def test_cycle_deny_access_missing_ppe(orchestrator):
    """A required PPE missing: gate stays closed and FAIL is logged."""
    orchestrator._rfid.read_card.return_value = "VALID_CARD"
    worker = WorkerInfo(1, "Zeynep Etik", "Engineer", [
        RequiredPpeItem(1, "HELMET"),
        RequiredPpeItem(2, "GLOVES"),
    ])
    orchestrator._backend.get_worker.return_value = worker

    # AI detects only HELMET; GLOVES is missing.
    orchestrator._ai.detect.return_value = DetectionResult(
        items=[_det(PPEClass.HELMET, 0.88)],
        success=True,
    )

    orchestrator._cycle()

    orchestrator._gate.gate_open.assert_not_called()
    orchestrator._display.notify_fail.assert_called_once()
    fail_args = orchestrator._display.notify_fail.call_args[0]
    assert fail_args[0] is worker
    assert fail_args[2] == ["GLOVES"]

    log_arg = orchestrator._backend.log_entry.call_args[0][0]
    assert log_arg.decision == AccessDecision.FAIL
    assert log_arg.missing_ppe == ["GLOVES"]

    detections_by_id = {d.ppe_item_id: d for d in log_arg.detections}
    assert detections_by_id[1].was_detected is True
    assert detections_by_id[1].confidence == pytest.approx(0.88, abs=1e-3)
    assert detections_by_id[2].was_detected is False
    assert detections_by_id[2].confidence is None


def test_cycle_unknown_card(orchestrator):
    """Unregistered card: UNKNOWN_CARD logged, gate stays closed."""
    orchestrator._rfid.read_card.return_value = "UNKNOWN_CARD_ID"
    orchestrator._backend.get_worker.return_value = None

    orchestrator._cycle()

    orchestrator._gate.gate_open.assert_not_called()
    orchestrator._display.notify_unknown_card.assert_called_once_with("UNKNOWN_CARD_ID")

    log_arg = orchestrator._backend.log_entry.call_args[0][0]
    assert log_arg.decision == AccessDecision.UNKNOWN_CARD
