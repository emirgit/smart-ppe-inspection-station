"""
Test suite for IoTOrchestrator state machine logic.
"""
import pytest
from unittest.mock import MagicMock, patch

from turnstile.IoT.impl.iot_orchestrator import IoTOrchestrator
from turnstile.IoT.include.iot_module import IoTConfig, SystemState
from turnstile.IoT.include.models import WorkerInfo, RequiredPpeItem, AccessDecision

@pytest.fixture
def orchestrator(mock_gate_controller, mock_ai_vision):
    """Tüm bağımlılıkları mocklanmış bir Orchestrator nesnesi sağlar."""
    rfid = MagicMock()
    backend = MagicMock()
    display = MagicMock()

    # OpenCV kamerasını mockluyoruz
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
            ai=mock_ai_vision
        )
        
        # Performansı artırmak için beklemeleri 10 ms yapıyoruz
        config = IoTConfig(denied_timeout_ms=10)
        orch.init(config)
        return orch

def test_cycle_grant_access(orchestrator):
    """Tam teşekküllü PPE giyen işçinin tespit edilip kapının (Gate) açılmasını test eder."""
    orchestrator._rfid.read_card.return_value = "VALID_CARD"
    
    worker = WorkerInfo(1, "Alperen Söylen", "Developer", [RequiredPpeItem(1, "HELMET")])
    orchestrator._backend.get_worker.return_value = worker
    
    # Yapay zeka conftest'ten HELMET ve VEST dönüyor (eksik PPE yok)
    orchestrator._cycle()

    # Kapı açılmalı ve izin verildi ekranı gösterilmeli
    orchestrator._gate.gate_open.assert_called_once()
    orchestrator._display.show_granted.assert_called_once_with("Alperen Söylen")
    
    # Backend log_entry PASS olarak kaydedilmeli
    log_arg = orchestrator._backend.log_entry.call_args[0][0]
    assert log_arg.decision == AccessDecision.PASS

def test_cycle_deny_access_missing_ppe(orchestrator):
    """Zorunlu bir koruyucu donanım (Örn: Eldiven) eksik olduğunda kapının kapalı kalmasını test eder."""
    orchestrator._rfid.read_card.return_value = "VALID_CARD"
    
    worker = WorkerInfo(1, "Zeynep Etik", "Engineer", [
        RequiredPpeItem(1, "HELMET"), 
        RequiredPpeItem(2, "GLOVES")
    ])
    orchestrator._backend.get_worker.return_value = worker
    
    # Yapay zeka sadece HELMET tespit etsin (GLOVES eksik)
    ai_result = MagicMock()
    ai_result.labels = ["HELMET"]
    orchestrator._ai.detect.return_value = ai_result

    orchestrator._cycle()

    # Kapı AÇILMAMALI ve eksik ekranı gösterilmeli
    orchestrator._gate.gate_open.assert_not_called()
    orchestrator._display.show_denied.assert_called_once_with(["GLOVES"])

    # Backend log_entry FAIL olarak kaydedilmeli
    log_arg = orchestrator._backend.log_entry.call_args[0][0]
    assert log_arg.decision == AccessDecision.FAIL
    assert log_arg.missing_ppe == ["GLOVES"]

def test_cycle_unknown_card(orchestrator):
    """Tanınmayan bir RFID kart okutulduğunda sistemin 'UNKNOWN_CARD' döngüsünü test eder."""
    orchestrator._rfid.read_card.return_value = "UNKNOWN_CARD_ID"
    # Backend bu ID'yi bulamasın
    orchestrator._backend.get_worker.return_value = None

    orchestrator._cycle()

    # Kapı açılmamalı
    orchestrator._gate.gate_open.assert_not_called()
    orchestrator._display.show_unknown_card.assert_called_once()

    # Backend'e UNKNOWN_CARD eylemi kaydedilmeli
    log_arg = orchestrator._backend.log_entry.call_args[0][0]
    assert log_arg.decision == AccessDecision.UNKNOWN_CARD
