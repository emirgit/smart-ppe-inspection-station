"""
Ortak test fixture'ları ve mock yapılandırmaları.
"""
import pytest
from unittest.mock import MagicMock

from turnstile.IoT.mock.mock_rfid_reader import MockRfidReader
from turnstile.IoT.mock.mock_backend_client import MockBackendClient
from turnstile.IoT.mock.mock_display_client import MockDisplayClient
from turnstile.IoT.impl.gate_control import GateController

@pytest.fixture
def mock_gate_controller():
    """Donanım gerektirmeyen GateController mock'u."""
    gate = MagicMock(spec=GateController)
    gate.open_duration_s = 1.0  # Testleri yavaşlatmamak için kısa süre
    gate.init.return_value = True
    return gate

@pytest.fixture
def mock_ai_vision():
    """AIVisionModule mock'u."""
    ai = MagicMock()
    # Varsayılan olarak kask ve yelek tespit etsin
    ai_result = MagicMock()
    ai_result.labels = ["HELMET", "VEST"]
    ai.detect.return_value = ai_result
    return ai
