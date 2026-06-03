"""
Ortak test fixture'ları ve mock yapılandırmaları.
"""
import pytest
from unittest.mock import MagicMock

from src.iot_core.hardware.gate_control import GateController
from ai_vision.include.module_ai_vision import (
    DetectionResult,
    PPEDetection,
    PPEClass,
)


@pytest.fixture
def mock_gate_controller():
    """Donanım gerektirmeyen GateController mock'u."""
    gate = MagicMock(spec=GateController)
    gate.open_duration_s = 1.0  # Testleri yavaşlatmamak için kısa süre
    gate.init.return_value = True
    return gate


def _make_detection(cls: PPEClass, confidence: float = 0.9) -> PPEDetection:
    """Builds a unit-sized PPEDetection for tests."""
    return PPEDetection(
        ppe_class=cls,
        confidence=confidence,
        x_center=0.5,
        y_center=0.5,
        width=0.4,
        height=0.4,
    )


@pytest.fixture
def mock_ai_vision():
    """AIVisionModule mock'u (HELMET + VEST tespit eder)."""
    ai = MagicMock()
    ai.init.return_value = True
    ai.detect.return_value = DetectionResult(
        items=[
            _make_detection(PPEClass.HELMET, 0.91),
            _make_detection(PPEClass.VEST, 0.87),
        ],
        timestamp_ms=0,
        success=True,
    )
    return ai
