"""
impl/__init__.py
================
MOD-03 IoT Module — Concrete Implementations Package

Exposes all production-ready implementation classes.

Usage:
    from turnstile.IoT.impl import SpiRfidReader, HttpBackendClient, GateController, IoTOrchestrator
"""

from .rfid_spi            import SpiRfidReader
from .http_backend_client import HttpBackendClient
from .gate_control        import GateController, GateConfig
from .iot_orchestrator    import IoTOrchestrator

__all__ = [
    "SpiRfidReader",
    "HttpBackendClient",
    "GateController",
    "GateConfig",
    "IoTOrchestrator",
]
