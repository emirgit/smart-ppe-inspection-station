"""
websocket_display_notifier.py
=============================
MOD-03 IoT Module — Concrete WebSocket DisplayNotifier

Hosts a small WebSocket server on the Raspberry Pi that pushes
structured state events to the MOD-05 turnstile display.  Bridges
the synchronous, threaded :class:`IoTOrchestrator` with the
``websockets`` library's asyncio event loop.

Wire protocol
-------------
The server matches the contract documented in ``DISPLAY_BRIDGE.md``
and ``mobile/src/interfaces/display_interface.ts``:

* Outbound frames (server → display): one JSON object per state
  transition.  Always carries a top-level ``state`` field.  See
  :func:`_build_payload` for the per-state shape.

* Inbound frames (display → server):
    - ``DISPLAY_READY`` — sent by the display once on connect.  The
      server logs it and immediately re-broadcasts the most recent
      state so a fresh client sees the current screen.
    - ``DISPLAY_ACK``   — sent after each render.  The server logs it
      for diagnostics and otherwise ignores it; the orchestrator does
      not block on ACKs.

Concurrency model
-----------------
The notifier owns a private background thread which runs an asyncio
event loop and the ``websockets`` server.  All :meth:`notify_*` calls
from the orchestrator's thread are forwarded onto that loop via
``loop.call_soon_threadsafe``, so the orchestrator's state machine
never blocks on socket I/O.

Authors : Emre İlhan Şenel    (230104004907) — Primary
          Alperen Söylen       (220104004024) — Reviewer
Date    : 2026-04-17
Version : 0.1
"""

from __future__ import annotations

import asyncio
import json
import logging
import threading
from datetime import datetime, timezone
from typing import Any, Optional

try:
    # ``websockets`` 12+ exposes ``serve``/``ServerConnection`` at top-level.
    import websockets
    from websockets.asyncio.server import ServerConnection, serve
except ImportError:  # pragma: no cover — surface a clear error at import time
    raise ImportError(
        "websockets>=12 is required for WebSocketDisplayNotifier. "
        "Install with: pip install 'websockets>=12,<15'"
    )

from ..include.display_notifier import DisplayNotifier
from ..include.models import RequiredPpeItem, WorkerInfo

logger = logging.getLogger(__name__)


# =============================================================================
# Pure helpers (kept module-level so they are unit-testable without sockets)
# =============================================================================

# Default INSPECTING instruction; the display falls back to its own copy when
# the field is omitted, but sending a value here keeps the message identical
# in the mock and the production path.
DEFAULT_INSPECTING_INSTRUCTION = (
    "Please face the camera and raise your hands"
)


def _now_iso() -> str:
    """Returns an ISO-8601 UTC timestamp suitable for the wire format."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _serialise_worker(worker: WorkerInfo) -> dict[str, Any]:
    """
    Maps the IoT-side :class:`WorkerInfo` onto the field names the
    MOD-05 display expects (``id``, ``full_name``, ``role_name``,
    ``photo_url``).  ``photo_url`` is always emitted as ``None`` since
    the current backend client does not surface a photo URL; the
    display tolerates ``None`` and falls back to initials.
    """
    return {
        "id":         worker.worker_id,
        "full_name":  worker.worker_name,
        "role_name":  worker.role,
        "photo_url":  None,
    }


def _serialise_ppe(items: list[RequiredPpeItem]) -> list[dict[str, Any]]:
    """
    Serialises a list of :class:`RequiredPpeItem` to the wire format.

    ``display_name`` and ``icon_name`` may be ``None`` on the dataclass
    (their dataclass defaults) but the display expects strings, so we
    fall back to ``item_key`` for both — that guarantees a renderable
    label and a sensible icon lookup key.
    """
    serialised: list[dict[str, Any]] = []
    for item in items:
        serialised.append({
            "id":           item.id,
            "item_key":     item.item_key,
            "display_name": item.display_name or item.item_key,
            "icon_name":    item.icon_name    or item.item_key,
        })
    return serialised


def _build_payload(
    state:         str,
    *,
    rfid_card_uid: Optional[str]                 = None,
    worker:        Optional[WorkerInfo]          = None,
    required_ppe:  Optional[list[RequiredPpeItem]] = None,
    detected_ppe:  Optional[list[RequiredPpeItem]] = None,
    missing_ppe:   Optional[list[RequiredPpeItem]] = None,
    instruction:   Optional[str]                 = None,
) -> dict[str, Any]:
    """
    Builds the JSON-serialisable payload for a single state event.

    Kept as a free function so the JSON contract can be tested without
    spinning up a WebSocket server.
    """
    payload: dict[str, Any] = {"state": state}

    if rfid_card_uid is not None:
        payload["rfid_card_uid"] = rfid_card_uid

    if worker is not None:
        payload["worker"] = _serialise_worker(worker)

    if required_ppe is not None:
        payload["required_ppe"] = _serialise_ppe(required_ppe)

    if detected_ppe is not None:
        payload["detected_ppe"] = _serialise_ppe(detected_ppe)

    if missing_ppe is not None:
        payload["missing_ppe"] = _serialise_ppe(missing_ppe)

    if instruction is not None:
        payload["instruction"] = instruction

    return payload


# =============================================================================
# Concrete notifier
# =============================================================================

class WebSocketDisplayNotifier(DisplayNotifier):
    """
    DisplayNotifier that broadcasts state events over a WebSocket.

    Args:
        host: Bind address.  Use ``0.0.0.0`` to accept connections from
              the LAN-attached tablet.
        port: TCP port to listen on.
        path: URL path the display connects to (``/ws/display`` by
              default).  Connections to other paths are rejected so
              accidental probes do not poison the broadcast list.
        default_instruction: Text sent in the INSPECTING payload's
              ``instruction`` field; pass ``None`` to omit it.
    """

    def __init__(
        self,
        host:                str           = "0.0.0.0",
        port:                int           = 8080,
        path:                str           = "/ws/display",
        default_instruction: Optional[str] = DEFAULT_INSPECTING_INSTRUCTION,
    ) -> None:
        self._host = host
        self._port = port
        self._path = path
        self._default_instruction = default_instruction

        # Protected by the loop thread; only accessed via the loop.
        self._clients: set[ServerConnection] = set()
        self._last_payload: Optional[dict[str, Any]] = None

        # Thread + loop are created lazily on start().
        self._loop:    Optional[asyncio.AbstractEventLoop] = None
        self._thread:  Optional[threading.Thread]          = None
        self._server:  Any                                 = None
        self._started: bool                                = False

    # -------------------------------------------------------------------------
    # Lifecycle
    # -------------------------------------------------------------------------

    def start(self) -> None:
        """
        Spins up the background thread + asyncio loop and begins
        accepting WebSocket connections.  Idempotent; a second call
        after a matching :meth:`stop` re-starts the server.
        """
        if self._started:
            logger.debug("WebSocketDisplayNotifier already started; skipping")
            return

        ready = threading.Event()
        startup_error: list[BaseException] = []

        def _run() -> None:
            loop = asyncio.new_event_loop()
            self._loop = loop
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(self._serve_until_stopped(ready))
            except BaseException as exc:  # noqa: BLE001
                startup_error.append(exc)
                ready.set()
            finally:
                try:
                    loop.run_until_complete(loop.shutdown_asyncgens())
                except Exception:  # pragma: no cover
                    pass
                loop.close()
                self._loop = None

        self._thread = threading.Thread(
            target=_run,
            name="display-ws-notifier",
            daemon=True,
        )
        self._thread.start()

        # Block until the server has either started successfully or failed.
        ready.wait(timeout=5.0)
        if startup_error:
            self._started = False
            raise startup_error[0]

        self._started = True
        logger.info(
            "WebSocketDisplayNotifier listening on ws://%s:%d%s",
            self._host, self._port, self._path,
        )

    def stop(self) -> None:
        """
        Stops accepting new connections, drops existing clients, and
        joins the background thread.  Safe to call when never started.
        """
        if not self._started or self._loop is None:
            return

        loop = self._loop
        # Schedule a shutdown coroutine on the server loop and wait for it.
        future = asyncio.run_coroutine_threadsafe(self._shutdown(), loop)
        try:
            future.result(timeout=5.0)
        except Exception as exc:  # pragma: no cover - best-effort shutdown
            logger.warning("WebSocketDisplayNotifier shutdown error: %s", exc)

        if self._thread is not None:
            self._thread.join(timeout=5.0)
        self._thread = None
        self._started = False
        logger.info("WebSocketDisplayNotifier stopped")

    # -------------------------------------------------------------------------
    # DisplayNotifier interface
    # -------------------------------------------------------------------------

    def notify_idle(self) -> None:
        self._broadcast(_build_payload("IDLE"))

    def notify_identifying(self, rfid_card_uid: str) -> None:
        self._broadcast(_build_payload(
            "IDENTIFYING",
            rfid_card_uid=rfid_card_uid,
        ))

    def notify_unknown_card(self, rfid_card_uid: str) -> None:
        self._broadcast(_build_payload(
            "UNKNOWN_CARD",
            rfid_card_uid=rfid_card_uid,
        ))

    def notify_inspecting(
        self,
        worker:        WorkerInfo,
        required_ppe:  list[RequiredPpeItem],
        instruction:   Optional[str] = None,
    ) -> None:
        self._broadcast(_build_payload(
            "INSPECTING",
            worker=worker,
            required_ppe=required_ppe,
            instruction=instruction or self._default_instruction,
        ))

    def notify_pass(
        self,
        worker:        WorkerInfo,
        detected_ppe:  list[RequiredPpeItem],
    ) -> None:
        self._broadcast(_build_payload(
            "PASS",
            worker=worker,
            detected_ppe=detected_ppe,
        ))

    def notify_fail(
        self,
        worker:        WorkerInfo,
        detected_ppe:  list[RequiredPpeItem],
        missing_ppe:   list[RequiredPpeItem],
    ) -> None:
        self._broadcast(_build_payload(
            "FAIL",
            worker=worker,
            detected_ppe=detected_ppe,
            missing_ppe=missing_ppe,
        ))

    # -------------------------------------------------------------------------
    # Internal: server coroutines (run on the notifier's loop thread)
    # -------------------------------------------------------------------------

    async def _serve_until_stopped(self, ready: threading.Event) -> None:
        """Brings the server up, signals readiness, then waits forever."""
        self._stop_event = asyncio.Event()
        self._server = await serve(
            self._client_handler,
            self._host,
            self._port,
            # ``websockets`` ≥12 supports a ``process_request`` hook; we use
            # a simple explicit path check inside the handler instead, so
            # this notifier remains compatible with both 12.x and 14.x.
        )
        ready.set()
        await self._stop_event.wait()
        self._server.close()
        await self._server.wait_closed()

    async def _shutdown(self) -> None:
        """Disconnect all clients and signal the serve loop to exit."""
        for ws in list(self._clients):
            try:
                await ws.close(code=1001, reason="server shutting down")
            except Exception:  # pragma: no cover
                pass
        self._clients.clear()
        if hasattr(self, "_stop_event"):
            self._stop_event.set()

    async def _client_handler(self, ws: ServerConnection) -> None:
        """
        Handles a single connected display client.

        Enforces the configured URL path, registers the client for
        broadcasts, replays the last known state immediately, and then
        consumes any inbound frames (DISPLAY_READY / DISPLAY_ACK)
        purely for logging.
        """
        # ``websockets`` 12+ exposes the request URI on the connection.
        request_path = getattr(ws, "request", None)
        path = getattr(request_path, "path", None) if request_path else None
        if path is not None and path != self._path:
            logger.warning(
                "Rejecting WebSocket connection on unexpected path %r "
                "(expected %r)", path, self._path,
            )
            await ws.close(code=1008, reason="unknown path")
            return

        peer = getattr(ws, "remote_address", "<unknown>")
        logger.info("Display client connected from %s", peer)
        self._clients.add(ws)

        # Replay the most recent payload so the new client immediately
        # shows the current state instead of staying on a stale screen
        # (or its built-in IDLE) until the next transition fires.
        if self._last_payload is not None:
            try:
                await ws.send(json.dumps(self._last_payload))
            except Exception as exc:  # pragma: no cover
                logger.warning("Failed to replay last payload: %s", exc)

        try:
            async for raw in ws:
                self._handle_inbound(raw, peer)
        except websockets.ConnectionClosed:
            pass
        finally:
            self._clients.discard(ws)
            logger.info("Display client disconnected from %s", peer)

    def _handle_inbound(self, raw: Any, peer: Any) -> None:
        """
        Logs DISPLAY_READY / DISPLAY_ACK frames and ignores everything
        else.  The orchestrator never blocks on these; they are purely
        diagnostic.
        """
        try:
            msg = json.loads(raw if isinstance(raw, (str, bytes, bytearray)) else "")
        except (TypeError, ValueError):
            logger.warning("Dropping non-JSON inbound frame from %s", peer)
            return

        msg_type = msg.get("type") if isinstance(msg, dict) else None
        if msg_type == "DISPLAY_READY":
            logger.info("DISPLAY_READY from %s (client_id=%s)",
                        peer, msg.get("client_id"))
        elif msg_type == "DISPLAY_ACK":
            logger.debug("DISPLAY_ACK from %s for state=%s",
                         peer, msg.get("state"))
        else:
            logger.debug("Unrecognised inbound frame from %s: %s", peer, msg)

    # -------------------------------------------------------------------------
    # Internal: broadcast plumbing (called from the orchestrator thread)
    # -------------------------------------------------------------------------

    def _broadcast(self, payload: dict[str, Any]) -> None:
        """
        Records ``payload`` as the latest state and (if a server is
        running) schedules an async broadcast onto the loop thread.
        Safe to call before :meth:`start` or after :meth:`stop`; in
        those cases the payload is still cached so a later ``start()``
        followed by a client connection will replay it.
        """
        # Add a server-side timestamp so the display can age stale frames
        # without coupling to the orchestrator's clock.
        framed = dict(payload)
        framed.setdefault("timestamp", _now_iso())

        loop = self._loop
        if loop is None or not self._started:
            self._last_payload = framed
            return

        loop.call_soon_threadsafe(self._loop_broadcast, framed)

    def _loop_broadcast(self, framed: dict[str, Any]) -> None:
        """Runs on the loop thread; updates cache and fans out to clients."""
        self._last_payload = framed
        if not self._clients:
            return
        text = json.dumps(framed)
        # Schedule one send-and-forget task per client.  We do not await
        # them collectively so a slow client cannot stall the rest.
        for ws in list(self._clients):
            asyncio.create_task(self._send_one(ws, text))

    async def _send_one(self, ws: ServerConnection, text: str) -> None:
        try:
            await ws.send(text)
        except Exception as exc:
            logger.warning("Drop client after send failure: %s", exc)
            self._clients.discard(ws)
            try:
                await ws.close()
            except Exception:  # pragma: no cover
                pass
