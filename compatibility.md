# Inter-Module Compatibility Notes
# AI-Powered Smart PPE Inspection Station — GROUP-11
# CSE 396, Gebze Technical University, Spring 2026

---

## Critical Incompatibilities

**C-01: PPE Naming Convention (MOD-01, MOD-03, MOD-04, MOD-05)**
MOD-01 uses short enum names (`HELMET`, `VEST`, `BOOTS`, `GOGGLES`) while MOD-04 and MOD-05 use underscore-prefixed strings (`hard_hat`, `safety_vest`, `safety_boots`, `safety_goggles`), with no mapping defined between them. Without a conversion layer in MOD-03, every PPE comparison across the inspection pipeline will silently fail.

**C-02: PPE Item ID vs. String Key (MOD-01, MOD-03, MOD-04)**
MOD-04 expects a database auto-increment integer (`ppe_item_id`) in the entry log payload, but MOD-01 identifies PPE classes by zero-based `PPEClass` IntEnum values that have no relation to database IDs. MOD-03 must either cache a `GET /api/ppe-items` lookup to resolve `item_key` to ID, or MOD-04 must accept `item_key` strings directly.

**C-03: `face_mask` Present in MOD-05, Absent in MOD-01 (MOD-01, MOD-05)**
MOD-05 declares `face_mask` as a valid `PpeItemKey`, but MOD-01's `PPEClass` enum and training dataset contain no face mask class. Any role that requires `face_mask` will cause every worker in that role to permanently fail inspection.

---

## Important Incompatibilities

**C-04: DisplayClient Schema vs. WebSocket Message Schema (MOD-03, MOD-05)**
MOD-03's `DisplayClient` interface passes only a worker name string and a flat `list[str]` for PPE, while MOD-05's `DisplayMessage` union type expects a full worker object (`id`, `full_name`, `photo_url`, `role_name`) and structured PPE object arrays. MOD-03 must expand its `DisplayClient` interface to carry the richer payload, and the transport protocol (WebSocket with ACK/READY handshake) must be confirmed by both teams.

**C-05: `AccessDecision` Integer vs. `EntryResult` String (MOD-03, MOD-04)**
MOD-03 represents inspection outcomes as an IntEnum (`PASS=1`, `FAIL=0`, `UNKNOWN_CARD=2`), but MOD-04's `CreateEntryLogRequest.result` field expects the string literals `'PASS'`, `'FAIL'`, or `'UNKNOWN_CARD'`. Sending integer values directly will cause a 422 validation error from the backend.

**C-06: C/C++ to Python Language Boundary (MOD-02, MOD-03)**
MOD-02 exposes gate control through C++ headers (`gate_control.hpp`, `servo_driver.hpp`), but MOD-03 is implemented entirely in Python. No binding mechanism (ctypes, cffi, subprocess, or a dedicated bridge module) has been specified or documented by either team.

**C-07: `required_ppe` Type — String List vs. Object Array (MOD-03, MOD-04)**
MOD-03's `WorkerInfo.required_ppe` is typed as `list[str]`, whereas MOD-04's `WorkerCardLookupResponse` returns `RequiredPpeItem[]`, an array of objects containing `id`, `item_key`, `display_name`, and `icon_name`. MOD-03 must flatten the object array and decide which field to use as the canonical string identifier.

---

## Medium Incompatibilities

**C-08: State Enum Name Mismatch (MOD-03, MOD-05)**
MOD-03 uses `GRANTED` and `DENIED` for terminal states, while MOD-05 uses `PASS` and `FAIL`; additionally, MOD-05 treats `UNKNOWN_CARD` as a distinct display state, but MOD-03 subsumes it under `DENIED`. A translation mapping must be applied in MOD-03 before any state value is forwarded to the display.

**C-09: `worker_id` Type — String vs. Integer (MOD-03, MOD-04)**
MOD-03 stores and transmits `worker_id` as a `str`, but MOD-04 defines `Worker.id` and `CreateEntryLogRequest.worker_id` as integers. Sending a string value will trigger a type validation error in the backend.

**C-10: `gate_open()` Blocking Behavior (MOD-02, MOD-03)**
MOD-02's `gate_open()` blocks the calling thread for approximately 5.35 seconds (350 ms servo sweep plus 5000 ms auto-close timer). MOD-03's main loop, including RFID reading, display updates, and backend communication, will be fully suspended for that duration unless the call is moved to a separate thread.

**C-11: Camera Output Frame Format (MOD-01, MOD-03)**
MOD-01 requires a 640x640 square frame and validates the byte length of `CameraFrame` as `width * height * 3`. Most camera modules, including the RPi Camera Module V3, output 4:3 or 16:9 aspect ratios by default, so MOD-03 must explicitly crop or resize the capture output to 640x640 before passing it to MOD-01.

---