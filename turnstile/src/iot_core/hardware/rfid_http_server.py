"""
rfid_http_server.py
===================
MOD-03 IoT Module — Webhook RFID Reader Implementation

This acts as a local HTTP Server. Instead of directly probing SPI hardware,
it opens port 8000 and waits for the ESP32 to push an RFID scan via HTTP POST.

When read_card() is called, it simply waits on a queue until the ESP32 sends
a scanned card UID.

Authors: Alperen Söylen (220104004024)
"""

from __future__ import annotations

import json
import logging
import threading
import queue
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Optional

from src.iot_core.interfaces.rfid_reader import RfidReader, RfidConfig, RfidMode

logger = logging.getLogger(__name__)

# Queue allows the HTTP handler thread to pass data to the waiting read_card thread
_rfid_queue: queue.Queue[str] = queue.Queue()

class RfidWebhookHandler(BaseHTTPRequestHandler):
    """Handles incoming HTTP POSTs from ESP32."""
    
    def do_POST(self) -> None:
        if self.path == '/rfid':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            
            try:
                data = json.loads(body)
                uid = data.get("uid")
                if uid:
                    logger.info("Webhook received RFID UID: %s", uid)
                    _rfid_queue.put(uid)
                
                # Send Success Response to ESP32
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status": "ok"}')
            except json.JSONDecodeError:
                self.send_response(400)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()
            
    def log_message(self, format: str, *args) -> None:
        # Suppress noisy HTTP server logs unless debugging
        pass

class HttpRfidReader(RfidReader):
    """
    RfidReader implementation designed to receive RFID taps via HTTP
    webhooks sent by a standalone ESP32.
    """
    def __init__(self) -> None:
        self._config: RfidConfig = RfidConfig()
        self._server: Optional[HTTPServer] = None
        self._thread: Optional[threading.Thread] = None
        
    def init(self, config: Optional[RfidConfig] = None) -> bool:
        """Starts the HTTP server to listen to the ESP32."""
        self._config = config or RfidConfig()
        
        # Start the internal HTTP server on port 8000
        port = 8000
        host = "0.0.0.0"
        
        try:
            self._server = HTTPServer((host, port), RfidWebhookHandler)
            self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
            self._thread.start()
            logger.info("HttpRfidReader: Listening for ESP32 Webhooks on %s:%d", host, port)
            return True
        except Exception as exc:
            logger.error("HttpRfidReader: Failed to start web server — %s", exc)
            return False

    def read_card(self, timeout_ms: Optional[int] = None) -> Optional[str]:
        """
        Blocks until the ESP32 sends a card via HTTP, or the timeout expires.
        """
        ms = timeout_ms if timeout_ms is not None else self._config.timeout_ms
        timeout_s = ms / 1000.0 if ms else None
        
        try:
            # Block until an item is available in the queue
            uid = _rfid_queue.get(timeout=timeout_s)
            return uid
        except queue.Empty:
            # No card received in the given time frame
            return None

    def cleanup(self) -> None:
        """Shuts down the HTTP server."""
        if self._server:
            # Tell the server to stop serving requests
            _shutdown_thread = threading.Thread(target=self._server.shutdown)
            _shutdown_thread.start()
            _shutdown_thread.join(timeout=2)
            self._server.server_close()
            
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)
            
        logger.info("HttpRfidReader: Webhook server stopped.")
