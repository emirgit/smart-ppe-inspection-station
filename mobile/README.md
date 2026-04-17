# MOD-05 / mobile — Turnstile Display

Tablet-side React application for the AI-Powered Smart PPE Inspection
Station (CSE 396, Gebze Technical University, Spring 2026, GROUP-11).

The display runs in a kiosk-mode browser at the turnstile gate. It
consumes real-time `DisplayMessage` events pushed over WebSocket from
the IoT module (MOD-03 / Raspberry Pi) and renders one of seven
inspection screens. The display itself never calls the backend; all
data originates from MOD-04 and is forwarded by MOD-03.

The published API contract for this module lives in
`doc/module_05_ui_ux/module_05_ui_ux/mobile/include/display_interface.d.ts`
and is mirrored in `src/interfaces/display_interface.ts`.

## Tech stack

- React 19 + TypeScript (Vite 6 build, Vitest 2 for tests)
- Tailwind CSS 4 (via `@tailwindcss/vite`)
- Native browser WebSocket API (no socket.io)

## Project layout

```
mobile/
├── index.html
├── public/                       static assets
├── src/
│   ├── App.tsx                   wires controller + ws/mock + screens
│   ├── main.tsx                  React entry point
│   ├── index.css                 Tailwind + custom keyframes
│   ├── interfaces/
│   │   └── display_interface.ts  IDisplayWSClient / IDisplayController
│   ├── hooks/
│   │   └── useDisplayController.ts
│   ├── lib/
│   │   ├── normalize.ts          payload normalization (C-04 / C-08)
│   │   ├── WebSocketClient.ts    IDisplayWSClient implementation
│   │   └── MockSimulator.ts      IMockEventSimulator implementation
│   ├── components/
│   │   ├── ConnectionBadge.tsx
│   │   ├── MockControls.tsx
│   │   ├── PpeList.tsx
│   │   └── WorkerCard.tsx
│   ├── screens/
│   │   └── Screens.tsx           IDLE / IDENTIFYING / UNKNOWN_CARD /
│   │                             INSPECTING / GRANTED / DENIED /
│   │                             CONNECTION_ERROR
│   └── __tests__/                SM-, SR-, WS- test suites
├── .env.example
├── eslint.config.js
├── vite.config.ts
├── vitest.config.ts
├── tsconfig*.json
└── package.json
```

## Local development

```powershell
npm install
copy .env.example .env.local       # then edit VITE_WS_URL / VITE_CLIENT_ID
npm run dev                        # http://localhost:5173
```

To run without the Raspberry Pi available, enable mock mode either by
setting `VITE_MOCK_MODE=true` in `.env.local` or by visiting the page
with `?mock=1`. In mock mode the WebSocket connection is not opened and
three scenario buttons appear in the lower-left corner driving the
state machine through PASS, FAIL, and UNKNOWN_CARD flows.

## Scripts

| Script                | Purpose                                                 |
|-----------------------|---------------------------------------------------------|
| `npm run dev`         | Start Vite dev server (HMR, accessible on LAN)          |
| `npm run build`       | Type-check then build the production bundle to `dist/`  |
| `npm run preview`     | Serve the production bundle locally                     |
| `npm run lint`        | ESLint over `src/` and config files                     |
| `npm run typecheck`   | `tsc -b --noEmit` for both app and node tsconfigs       |
| `npm run test`        | Vitest in watch mode                                    |
| `npm run test:run`    | Single-shot test run, used in CI                        |

## Environment variables

All variables are read by Vite, so they must be prefixed with `VITE_`.

| Variable           | Description                                                | Example                                |
|--------------------|------------------------------------------------------------|----------------------------------------|
| `VITE_WS_URL`      | Full WebSocket URL exposed by MOD-03                       | `ws://192.168.1.100:8080/ws/display`   |
| `VITE_CLIENT_ID`   | Identifier sent in the `DISPLAY_READY` handshake           | `turnstile-display-01`                 |
| `VITE_MOCK_MODE`   | When `true`, skip the WebSocket and run MockSimulator      | `true`                                 |

The URL parameter `?mock=1` overrides `VITE_MOCK_MODE` at runtime, which is convenient for demos.

## State machine

The state machine lives in `useDisplayController` and follows the
diagram in `doc/knowledge.md`. The hook owns the active state, the
last `DisplayMessage`, the connection status, and the auto-return
timer that brings the screen back to IDLE after a terminal state.
Auto-return durations come from the public interface constants:
`DISPLAY_PASS_TIMEOUT_MS`, `DISPLAY_FAIL_TIMEOUT_MS`, and
`DISPLAY_UNKNOWN_CARD_TIMEOUT_MS`.

## Defensive normalization

`src/lib/normalize.ts` cushions three documented integration mismatches
(see `doc/compatibility.md`):

- **C-08** — Accepts both MOD-03 names (`GRANTED`/`DENIED`) and the MOD-04 names (`PASS`/`FAIL`) and folds them into the `DisplayState` enum.
- **C-04 / C-07** — Accepts PPE arrays as either `string[]` or rich `RequiredPpeItem[]` and emits the rich form for downstream rendering.
- **C-04** — Accepts a flat `worker_name`/`role` payload as a fallback when the rich `worker` object is missing.

Unknown states or non-object payloads are dropped with a `console.warn`,
so a malformed frame from MOD-03 cannot crash the display.

## Testing

The test suite mirrors the matrix in `doc/knowledge.md`:

| Group | Test IDs        | File                                          |
|-------|-----------------|-----------------------------------------------|
| State | SM-01 .. SM-10  | `src/__tests__/useDisplayController.test.ts`  |
| Screens | SR-01 .. SR-06 | `src/__tests__/screens.test.tsx`              |
| WebSocket | WS-01 .. WS-04 | `src/__tests__/WebSocketClient.test.ts`     |
| Mock E2E | (App scenarios) | `src/__tests__/MockSimulator.test.tsx`     |

Run them all with `npm run test:run`.
