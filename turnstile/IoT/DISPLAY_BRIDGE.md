# MOD-03 ↔ MOD-05 Display Bridge — Handoff Notes

> **Author:** Emre İlhan Şenel (MOD-05) · **Reviewer:** Alperen Söylen (MOD-03)
> **Branch:** `feature/mod03-display-bridge` · **Date:** 2026-04-17
> **PR target:** `main` (merge by Muhammed after Alperen reviews)

This document explains the changes I (MOD-05) made inside the IoT
package so the React turnstile display can subscribe to MOD-03 state
transitions over a WebSocket. It is meant for review, not as
specification — anything below is open to challenge.

The goal was the smallest possible change to the existing IoT code:
**no behaviour of the access-control state machine changes for callers
that don't pass a notifier**, and no existing test was modified.

---

## TL;DR — what to look at

| Area | Files | Risk |
|---|---|---|
| New optional dependency injection | `impl/iot_orchestrator.py` (~30 lines) | Low — new ctor kwarg defaults to `None`, all wiring guarded |
| New `SystemState.UNKNOWN_CARD` | `include/iot_module.py` | Low — appended to enum, existing values unchanged |
| New `IoTConfig.display_ws_*` fields | `include/iot_module.py` | Low — appended dataclass fields with defaults |
| New abstract `DisplayNotifier` | `include/display_notifier.py` (new) | Low — independent of `DisplayClient` |
| New WebSocket implementation | `impl/websocket_display_notifier.py` (new) | Medium — async + thread plumbing; covered by tests |
| New mock implementation | `mock/mock_display_notifier.py` (new) | Low |
| New tests | `tests/test_display_notifier.py` (new, 17 cases) | n/a |
| New runtime deps | `requirements.txt` (new) | Low — `websockets>=12,<15` |

All existing tests still pass (`pytest --deselect
tests/test_backend_integration.py::test_live_log_entry_unknown_card`
gives `24 passed`; the deselected test was already failing on `main`
because the Heroku backend returned 500).

---

## Why a separate `DisplayNotifier` instead of extending `DisplayClient`?

`DisplayClient` only carries strings (`worker_name`,
`missing_ppe: list[str]`) and has a working mock (`MockDisplayClient`)
that the orchestrator tests rely on. The MOD-05 React display, however,
needs the full payload from `mobile/src/interfaces/display_interface.ts`:

```jsonc
{
  "state": "INSPECTING",
  "worker": { "id", "full_name", "role_name", "photo_url" },
  "required_ppe": [ {"id","item_key","display_name","icon_name"}, ... ],
  "instruction": "..."
}
```

If I had widened `DisplayClient`, every implementation (including the
mock) would have had to change, and `iot_orchestrator.py`'s call sites
would have grown new positional arguments. Instead, I added a parallel
optional collaborator:

```python
class DisplayNotifier(ABC):
    def start(self) -> None: ...
    def stop(self) -> None: ...
    def notify_idle(self) -> None: ...
    def notify_identifying(self, rfid_card_uid: str) -> None: ...
    def notify_unknown_card(self, rfid_card_uid: str) -> None: ...
    def notify_inspecting(worker, required_ppe, instruction=None) -> None: ...
    def notify_pass(worker, detected_ppe) -> None: ...
    def notify_fail(worker, detected_ppe, missing_ppe) -> None: ...
```

This means:

* Existing deployments that don't construct an `IoTOrchestrator(... notifier=...)`
  keep behaving exactly as before.
* The mock display client and its colour-coded stdout output are
  untouched; they still run during `_cycle()`.
* Future transports (HTTP polling, MQTT) can implement the same ABC
  without touching the orchestrator again.

If you'd rather collapse everything into a single richer `DisplayClient`
later, that refactor stays a one-week task; nothing here locks us in.

---

## Wire format

Every state transition produces a single JSON frame. The schema below
matches the display normaliser
(`mobile/src/lib/normalize.ts`) byte-for-byte.

| State | Required fields | Optional |
|---|---|---|
| `IDLE`         | `state` | `timestamp` (server-added) |
| `IDENTIFYING`  | `state`, `rfid_card_uid` | `timestamp` |
| `UNKNOWN_CARD` | `state`, `rfid_card_uid` | `timestamp` |
| `INSPECTING`   | `state`, `worker`, `required_ppe`, `instruction` | `timestamp` |
| `PASS`         | `state`, `worker`, `detected_ppe` | `timestamp` |
| `FAIL`         | `state`, `worker`, `detected_ppe`, `missing_ppe` | `timestamp` |

Sample (`INSPECTING`):

```json
{
  "state": "INSPECTING",
  "worker": {
    "id": 1,
    "full_name": "Ahmet Yılmaz",
    "role_name": "Technician",
    "photo_url": null
  },
  "required_ppe": [
    {"id": 1, "item_key": "hard_hat",   "display_name": "Hard Hat",   "icon_name": "hard_hat"},
    {"id": 2, "item_key": "safety_vest", "display_name": "Safety Vest", "icon_name": "safety_vest"}
  ],
  "instruction": "Please face the camera and raise your hands",
  "timestamp": "2026-04-17T12:34:56.789Z"
}
```

Inbound frames from the display (server logs them but does not block
on them):

| `type`           | When the display sends it | Server reaction |
|---|---|---|
| `DISPLAY_READY`  | Once on connect | Logs at INFO; the most recent payload is replayed automatically before this frame is read |
| `DISPLAY_ACK`    | After each render | Logs at DEBUG; otherwise ignored |

---

## Field-name translation (this is the important part for review)

The MOD-05 contract names worker fields differently from
`models.WorkerInfo`. The bridge translates them in
`_serialise_worker`:

| `WorkerInfo` field | Wire field | Notes |
|---|---|---|
| `worker_id`        | `id`         | direct |
| `worker_name`      | `full_name`  | direct |
| `role`             | `role_name`  | direct |
| (none)             | `photo_url`  | always `null` because `BackendClient` does not surface a photo URL today; if you add one, expose it on `WorkerInfo` and I'll wire it through |

For PPE items, when `display_name` or `icon_name` is `None` on a
`RequiredPpeItem`, the bridge falls back to `item_key` so the display
always gets a renderable label. This keeps the existing tests
(`RequiredPpeItem(1, "HELMET")` constructor calls with positional args
only) working.

For the `*_ppe` lists in `PASS` / `FAIL`, the orchestrator currently
holds `detected_ppe` and `missing_ppe` as `list[str]` (item keys), so
the bridge resolves them back to rich items via
`worker.required_ppe`. If a key cannot be resolved (cross-module
PPE-naming TODO in `models.py`), the bridge emits a synthetic item with
`id=-1` and `display_name=icon_name=item_key`, so the display still
renders something readable.

---

## Lifecycle and concurrency

`IoTOrchestrator` is synchronous and threaded; `websockets` is asyncio.
The bridge owns its own daemon thread and event loop:

```
                     ┌── orchestrator thread ──┐
                     │  notifier.notify_pass() │
                     └────────────┬────────────┘
                                  │  call_soon_threadsafe
                                  ▼
        ┌────────── notifier loop thread (daemon) ──────────┐
        │  asyncio loop  ←  WebSocket server (websockets)   │
        │                                                   │
        │  broadcast → connected display clients (set[ws])  │
        └───────────────────────────────────────────────────┘
```

`notify_*` calls are fire-and-forget from the orchestrator's
perspective. A slow or disconnected client cannot stall the state
machine, and any send failure simply drops that client from the set.

`start()` is idempotent. `stop()` is safe to call without a prior
`start()`. Both happen exactly once inside `IoTOrchestrator.init()`
and `IoTOrchestrator.stop()` respectively.

---

## Failure model

Every notifier interaction inside `iot_orchestrator.py` is wrapped in
`try/except` and downgraded to `logger.warning`. **The display bridge
must never fail an access decision.** If the WebSocket layer crashes
mid-cycle, the gate still opens or stays closed exactly as before; the
display simply misses an update. The `test_notifier_failure_does_not_break_cycle`
test pins this behaviour.

If `notifier.start()` raises during `init()`, the orchestrator nulls
out the notifier and continues without it (logged at WARNING).

---

## Configuration

`IoTConfig` gained three optional fields with sane defaults:

```python
display_ws_host: str = "0.0.0.0"
display_ws_port: int = 8080
display_ws_path: str = "/ws/display"
```

These are read by the caller that constructs the
`WebSocketDisplayNotifier`; the orchestrator itself does not consume
them. A typical wiring on the Pi will look like:

```python
from turnstile.IoT.impl.iot_orchestrator         import IoTOrchestrator
from turnstile.IoT.impl.websocket_display_notifier import WebSocketDisplayNotifier
from turnstile.IoT.include.iot_module             import IoTConfig

config = IoTConfig()
notifier = WebSocketDisplayNotifier(
    host=config.display_ws_host,
    port=config.display_ws_port,
    path=config.display_ws_path,
)
iot = IoTOrchestrator(
    rfid=..., backend=..., display=...,
    gate=..., ai=...,
    notifier=notifier,
)
iot.init(config)
iot.run()
```

The display side reads `VITE_WS_URL=ws://<RPI_IP>:8080/ws/display`
from its `.env`, so leaving the defaults aligned with that file means
zero extra config on either end.

---

## Decisions I made on your behalf (please challenge any of these)

1. **State name spelling:** the wire uses `PASS` / `FAIL` to mirror
   `AccessDecision.PASS` / `AccessDecision.FAIL`. The display
   normaliser also accepts `GRANTED` / `DENIED`, so we can flip later
   without touching either side.

2. **`SystemState.UNKNOWN_CARD = 5`** appended to the enum. The cycle
   no longer overloads `DENIED` for unknown cards; instead it transitions
   to `UNKNOWN_CARD` and still sleeps for `denied_timeout_ms` so the
   physical timing is unchanged. The backend audit log is still written
   with `AccessDecision.UNKNOWN_CARD`, so MOD-04 is unaffected.

3. **`photo_url` is always `null`.** I did not change `WorkerInfo` or
   `BackendClient` to carry a photo URL. Add one when MOD-04 surfaces it.

4. **`instruction` text** defaults to
   `"Please face the camera and raise your hands"`, matching the
   display's mock. Pass an explicit string to
   `notify_inspecting(..., instruction=...)` to override per worker
   role.

5. **Initial sync on connect.** When a display client connects, the
   server immediately re-broadcasts the most recent cached payload so
   the tablet shows the current state instead of stale content. This
   also covers the case where the bridge starts before the display.

6. **WebSocket path** is `/ws/display`. Connections to other paths are
   closed with code `1008` ("policy violation") to keep accidental
   probes from polluting the broadcast set.

7. **Dependency:** `websockets>=12,<15`. We pinned version 14 in
   tests; the API surface used (`websockets.asyncio.server.serve`) is
   stable across the 12-14 range.

---

## What I deliberately did not touch

* `MockDisplayClient` — left as-is so the existing colour-coded stdout
  view still works.
* `_run_inspection` and the `result.labels` TODO — that is the
  MOD-01 (Zeynep) integration question.
* `BackendClient`, `RfidReader`, `GateController` and any of their
  implementations.
* The `AccessDecision` and `WorkerInfo` dataclasses (no field changes).
* The existing test file `tests/test_iot_orchestrator.py` — only the
  new `tests/test_display_notifier.py` was added.

---

## Test surface

`tests/test_display_notifier.py` covers:

| Group | Cases |
|---|---|
| Payload helpers | 7 |
| `MockDisplayNotifier` | 3 |
| Orchestrator wiring (IDLE, GRANT, DENY, UNKNOWN_CARD, failure-isolation) | 5 |
| Real WebSocket loopback round-trip + bad-path rejection | 2 |

Run from `turnstile/IoT/`:

```bash
python -m pytest tests/test_display_notifier.py -v
# or, full suite:
python -m pytest --deselect tests/test_backend_integration.py::test_live_log_entry_unknown_card
```

---

## Open questions for you (Alperen)

Please respond inline on the PR or on Discord:

1. **Notifier wiring point.** Right now the caller of `IoTOrchestrator(...)`
   constructs the notifier. Would you prefer the orchestrator to build
   one internally based on `IoTConfig`, so the Pi entrypoint script
   stays a one-liner? Either is fine; let me know.
2. **Per-worker instruction text.** Is there a place on `WorkerInfo`
   (or the role) where MOD-04 could surface a custom instruction
   string? If so, I'll wire it through.
3. **Photo URL.** Same question — if MOD-04 already returns a photo
   URL, just point me at the field name and I'll add it to
   `WorkerInfo` and the bridge in one tiny commit.
4. **Connection loss while INSPECTING.** Today, if the display
   disconnects mid-INSPECTING, it auto-reconnects and the bridge
   replays the most recent state. Is that the behaviour you want, or
   should the orchestrator abort the cycle and reset to IDLE on
   prolonged disconnects?
5. **State naming.** Comfortable with `PASS` / `FAIL` on the wire, or
   prefer `GRANTED` / `DENIED`? The display accepts both today.

If you have no objections, leave the PR description blank and approve;
I'll mark it ready and let Muhammed merge.
