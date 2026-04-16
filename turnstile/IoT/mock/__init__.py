"""
mock/__init__.py
================
MOD-03 IoT Module — Mock Implementations Package

Exposes all mock classes for easy import during development and testing.
None of these require real hardware; they simulate behaviour in-process.

Usage:
    from mock import MockRfidReader, MockBackendClient, MockDisplayClient
"""

from .mock_rfid_reader    import MockRfidReader
from .mock_backend_client import MockBackendClient, FAKE_WORKERS
from .mock_display_client import MockDisplayClient

__all__ = [
    "MockRfidReader",
    "MockBackendClient",
    "MockDisplayClient",
    "FAKE_WORKERS",
]
