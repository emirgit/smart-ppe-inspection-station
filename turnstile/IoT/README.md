# MOD-03 — IoT Module

> Central orchestrator running on the Raspberry Pi 5 that coordinates
> RFID reading, AI PPE detection, gate control, backend communication,
> and turnstile display across all modules in the access control flow.

---

## Authors

| Name | Student ID | Role |
|---|---|---|
| Alperen Söylen | 220104004024 | Primary |
| Zeynep Etik | 220104004035 | Secondary |
| Mümincan Durak | 210104004057 | Secondary |
| Emre İlhan Şenel | 230104004907 | Secondary |
| Hüseyin Elyesa Yeşilyurt | 210104004080 | Secondary |

---

## Dependencies

### Other Modules

| Module | Why needed |
|---|---|
| MOD-01 (AI & Vision) | IoT provides a camera frame; calls `AIVisionModule.detect(frame)` during INSPECTING state |
| MOD-02 (Turnstile) | Calls `gate_open()` / `gate_close()` on access decision |
| MOD-04 (Backend) | `BackendClient.get_worker(card_id)` for identity lookup; `BackendClient.log_entry()` for audit |
| MOD-05 (UI/UX Display) | `DisplayClient.show_*()` to push status screens to the turnstile display |

### External Libraries / System Requirements

| Dependency | Version | Purpose |
|---|---|---|
| Python | 3.11+ | Runtime language |
| `RPi.GPIO` / `gpiozero` | latest | GPIO access for camera trigger and status signals |
| `opencv-python` / system OpenCV (`cv2`) | latest | Camera frame capture via `cv2.VideoCapture` on Raspberry Pi |
| `picamera2` | latest | Optional Raspberry Pi camera stack support, if used by the local camera setup |
| `spidev` / `mfrc522` | latest | SPI driver for RC522 RFID reader (used when mode=SPI) |
| `requests` | latest | HTTP client for BackendClient and WiFi RFID polling |

> **Hardware prerequisites:** Raspberry Pi 5, RC522 RFID reader (SPI or via ESP32 over WiFi),
> Raspberry Pi Camera Module, display connected to MOD-05, MOD-02 gate hardware on I2C.

---

## Quick-Start Integration Example

```python
from turnstile.IoT.include.iot_module import IoTModule, IoTConfig

# Obtain a concrete implementation of IoTModule
iot: IoTModule = get_iot_impl()

# Initialize all sub-components
config = IoTConfig(
    backend_url="http://192.168.1.10:8000/api",
    display_url="http://192.168.1.20:3000",
    denied_timeout_ms=5000,
)
ok = iot.init(config)
if not ok:
    raise RuntimeError("IoT module failed to initialize")

# Start the main access control loop (blocks until stop() is called)
iot.run()

# On shutdown (called from signal handler or another thread)
iot.stop()
```

### RfidReader standalone usage

```python
from turnstile.IoT.include.rfid_reader import RfidReader, RfidConfig, RfidMode

reader: RfidReader = get_rfid_impl()
reader.init(RfidConfig(mode=RfidMode.SPI))

card_id = reader.read_card(timeout_ms=10000)
if card_id:
    print(f"Card scanned: {card_id}")

reader.cleanup()
```

### BackendClient standalone usage

```python
from turnstile.IoT.include.backend_client import BackendClient
from turnstile.IoT.include.models import EntryLog, AccessDecision

client: BackendClient = get_backend_impl()

worker = client.get_worker("1A2B3C4D")
if worker:
    print(f"{worker.worker_name} — required PPE: {worker.required_ppe}")

client.log_entry(EntryLog(
    card_id="1A2B3C4D",
    worker_id=worker.worker_id,
    decision=AccessDecision.PASS,
    detected_ppe=["HELMET", "VEST"],
    missing_ppe=[],
    timestamp_ms=current_time_ms,
))
```

---

## API Summary

### `iot_module.py` — Central Orchestrator

#### Class: `IoTModule`

| Method | Parameters | Returns | Description |
|---|---|---|---|
| `init` | `config: IoTConfig \| None` | `bool` | Initializes all sub-components. Must be called before `run()`. |
| `run` | — | `None` | Starts the main access control loop. Blocks until `stop()` is called. |
| `stop` | — | `None` | Signals loop to exit; closes gate and releases all resources. |
| `get_state` | — | `SystemState` | Returns current system state. |

#### `SystemState` Enum

| Value | ID | Meaning |
|---|---|---|
| `IDLE` | 0 | Waiting for RFID card |
| `IDENTIFYING` | 1 | Card read; querying backend for worker info |
| `INSPECTING` | 2 | Worker identified; running AI PPE detection |
| `GRANTED` | 3 | All required PPE present; gate opening |
| `DENIED` | 4 | Required PPE missing or card unknown; gate locked |

#### `IoTConfig` Dataclass

| Field | Default | Meaning |
|---|---|---|
| `backend_url` | `http://localhost:8000/api` | MOD-04 REST API base URL |
| `display_url` | `http://localhost:3000` | MOD-05 display endpoint |
| `denied_timeout_ms` | 5000 | Milliseconds before DENIED resets to IDLE |
| `frame_width` | 640 | Camera frame width passed to AI module |
| `frame_height` | 640 | Camera frame height passed to AI module |

---

### `rfid_reader.py` — RFID Reader Interface

#### Class: `RfidReader`

| Method | Parameters | Returns | Description |
|---|---|---|---|
| `init` | `config: RfidConfig \| None` | `bool` | Initializes reader hardware or network connection. |
| `read_card` | `timeout_ms: int \| None` | `str \| None` | Blocks until card detected or timeout. Returns UID hex string or None. |
| `cleanup` | — | `None` | Releases GPIO, SPI, or network resources. |

#### `RfidConfig` Dataclass

| Field | Default | Meaning |
|---|---|---|
| `mode` | `RfidMode.SPI` | Connection mode (SPI or WIFI) |
| `wifi_url` | `http://192.168.1.100:8080` | ESP32 HTTP endpoint (WIFI mode only) |
| `spi_bus` | 0 | SPI bus number (SPI mode only) |
| `spi_device` | 0 | SPI device number (SPI mode only) |
| `timeout_ms` | 30000 | Default read timeout (ms) |

---

### `backend_client.py` — Backend Client Interface

#### Class: `BackendClient`

| Method | Parameters | Returns | Description |
|---|---|---|---|
| `get_worker` | `card_id: str` | `WorkerInfo \| None` | Fetches worker profile and required PPE list. Returns None if card unregistered. |
| `log_entry` | `log: EntryLog` | `bool` | Sends access attempt record to backend. Returns True on success. |

---

### `display_client.py` — Display Client Interface

#### Class: `DisplayClient`

| Method | Parameters | Returns | Description |
|---|---|---|---|
| `show_idle` | — | `None` | Shows idle/waiting screen ("Please scan your card"). |
| `show_scanning` | — | `None` | Shows PPE scan instruction ("Please stand in front of the camera"). |
| `show_granted` | `worker_name: str` | `None` | Shows access granted screen with personalized welcome message. |
| `show_denied` | `missing_ppe: list[str]` | `None` | Shows access denied screen listing missing PPE items. |
| `show_unknown_card` | — | `None` | Shows unregistered card screen ("Card not registered. Access denied."). |

---

### `models.py` — Shared Data Types

| Type | Description |
|---|---|
| `AccessDecision` | Enum: `FAIL = 0`, `PASS = 1`, `UNKNOWN_CARD = 2` — aligned with MOD-04 `EntryResult` |
| `WorkerInfo` | Worker profile: `worker_id`, `worker_name`, `role`, `required_ppe: list[RequiredPpeItem]` where each item includes `id` and `item_key` |
| `EntryLog` | Access attempt record: `card_id`, `worker_id`, `decision`, `detected_ppe`, `missing_ppe`, `timestamp_ms` |

---

## Inter-Module Communication

| From | To | Signal / Data | Direction | Notes |
|---|---|---|---|---|
| MOD-03 (IoT) | MOD-01 (AI Vision) | `CameraFrame` | IoT → Vision | IoT captures frame and calls `detect(frame)` |
| MOD-01 (AI Vision) | MOD-03 (IoT) | `DetectionResult` | Vision → IoT | IoT compares `detected_ppe` vs `WorkerInfo.required_ppe` |
| MOD-03 (IoT) | MOD-02 (Turnstile) | `gate_open()` / `gate_close()` | IoT → Turnstile | Called on GRANTED / DENIED decision |
| MOD-03 (IoT) | MOD-04 (Backend) | `get_worker(card_id)` | IoT → Backend | HTTP GET on every card scan |
| MOD-03 (IoT) | MOD-04 (Backend) | `EntryLog` | IoT → Backend | HTTP POST after every access decision |
| MOD-03 (IoT) | MOD-05 (Display) | `show_*()` calls | IoT → Display | Pushed at each state transition |

---

## Known Limitations & TODOs

- **RFID mode undecided:** SPI (direct RC522) vs WiFi (via ESP32) is not yet finalized; `RfidMode` flag controls this.
- **Camera capture ownership:** IoT is responsible for capturing the frame and passing it to MOD-01 via `detect(frame)`. Camera library (e.g. picamera2) is an implementation detail.
- **Display transport undecided:** WebSocket vs HTTP for pushing display instructions to MOD-05 is TBD.
- **TODO (Conflict 1 — MOD-03 ↔ MOD-01 ↔ MOD-04):** PPE naming contract not agreed. MOD-01 produces PPE labels as `PPEClass` enum names; MOD-04 stores PPE items by `item_key` strings. Teams must confirm that `item_key` values exactly match `PPEClass` names, or define a shared mapping.
- **TODO (Conflict 2 — MOD-03 ↔ MOD-04):** PPE item ID mismatch. MOD-04 uses database integer `ppe_item_id` (1..N); MOD-01 uses `PPEClass` integer enum values (0..10). These are different ID spaces. MOD-03 and MOD-04 must agree on a resolution (e.g., MOD-03 sends `item_key` strings and MOD-04 resolves IDs server-side).
- **TODO:** Finalize backend API URL and endpoint paths with MOD-04 team.
- **TODO:** Confirm display endpoint and message format with MOD-05 team.
- **TODO:** Define retry and fallback behavior when backend is unreachable.
- **TODO:** Define behavior when AI Vision module returns `success = False`.

---

## File Structure

```
module_03_iot/
├── include/
│   ├── iot_module.py       ← Central orchestrator interface (IoTModule)
│   ├── rfid_reader.py      ← RFID reader interface (RfidReader)
│   ├── backend_client.py   ← Backend communication interface (BackendClient)
│   ├── display_client.py   ← Display push interface (DisplayClient)
│   ├── models.py           ← Shared data types (WorkerInfo, EntryLog, AccessDecision)
│   └── rfid_esp32.h        ← ESP32 firmware C interface (optional hardware path)
└── README.md               ← This file
```

---

## Version History

| Version | Date | Changes |
|---|---|---|
| v0.1 | 2026-03-29 | Initial scaffold — concrete implementation classes (incorrect approach) |
| v0.2 | 2026-03-29 | Full rewrite as abstract interfaces; removed implementation files; added `display_client.py` and `iot_module.py` |
| v0.3 | 2026-03-29 | `AccessDecision` aligned with MOD-04 `EntryResult` (GRANTED→PASS, DENIED→FAIL, added UNKNOWN_CARD); added cross-module conflict TODOs |
