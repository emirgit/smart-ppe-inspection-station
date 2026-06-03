/**
 * @file    display_interface.d.ts
 * @brief   Turnstile Display Module — Public Interface
 *
 *          Defines all data types, WebSocket message schemas, state machine
 *          transitions, and public API functions for the tablet-side turnstile
 *          display application (MOD-05 / mobile).
 *
 *          This module CONSUMES real-time inspection events pushed by MOD-03
 *          (IoT / Raspberry Pi) over a WebSocket connection and renders the
 *          appropriate UI screen on the turnstile-side tablet.
 *
 *          The RPi (MOD-03) orchestrates the full inspection state machine:
 *            1. Reads RFID card
 *            2. Queries MOD-04 (Backend) for worker info + required PPE
 *            3. Runs AI inference via MOD-01
 *            4. Compares detected vs required PPE
 *            5. Pushes each state transition to this display via WebSocket
 *            6. Logs the result back to MOD-04
 *
 *          Data types (RequiredPpeItem, EntryResult, worker structure) are
 *          aligned with MOD-04 backend.d.ts v1.2.0 since the data originates
 *          from the backend database and passes through MOD-03.
 *
 * @module  MOD-05 / mobile (Turnstile Display)
 * @author  Emre İlhan Şenel (230104004907) — Primary
 * @date    2026-03-28
 * @version 0.4
 *
 * Changelog:
 *   v0.4 (2026-03-29) — Renamed from display_interface.ts to display_interface.d.ts;
 *                        constants converted to const; enums converted to
 *                        enum; added @return void to all void methods;
 *                        normalized @returns to @return.
 *   v0.3 (2026-03-28) — Corrected event source: MOD-03 (RPi) pushes
 *                        WebSocket events to display, not MOD-04.
 *                        MOD-04 is data-only (REST); MOD-03 orchestrates
 *                        the state machine and relays data to display.
 *   v0.2 (2026-03-28) — Aligned with MOD-04 backend.d.ts v1.2.0:
 *                        snake_case naming, RequiredPpeItem structure,
 *                        EntryResult (PASS/FAIL/UNKNOWN_CARD),
 *                        WorkerCardLookup response structure.
 *   v0.1 (2026-03-28) — Initial draft.
 */

/* ================================================================== */
/*  Re-exported types from MOD-04 (backend.d.ts)                      */
/*  These types are owned by MOD-04. MOD-03 fetches this data from    */
/*  the backend and forwards it to the display via WebSocket.         */
/* ================================================================== */

/**
 * @brief PPE item as stored in the backend database.
 *
 * Imported from MOD-04 backend.d.ts → RequiredPpeItem.
 * MOD-03 retrieves these from MOD-04 and includes them in WebSocket
 * messages sent to this display module.
 */
export interface RequiredPpeItem {
  id: number;
  /** Machine-readable key, e.g. "hard_hat", "safety_vest" */
  item_key: string;
  /** Human-readable label, e.g. "Hard Hat", "Safety Vest" */
  display_name: string;
  /** Icon identifier for UI rendering */
  icon_name: string;
}

/**
 * @brief Entry result type from MOD-04.
 *
 * Mirrors MOD-04's EntryResult exactly.
 *   - "PASS"         → all required PPE detected, access granted
 *   - "FAIL"         → one or more required PPE missing, access denied
 *   - "UNKNOWN_CARD" → RFID card not found in database
 */
export type EntryResult = "PASS" | "FAIL" | "UNKNOWN_CARD";

/* ================================================================== */
/*  Constants                                                         */
/* ================================================================== */

/** @brief WebSocket endpoint path on the Raspberry Pi (MOD-03) server. */
export const DISPLAY_WS_ENDPOINT: string = "/ws/display";

/** @brief Default WebSocket reconnection interval in milliseconds. */
export const DISPLAY_RECONNECT_INTERVAL_MS: number = 3000;

/** @brief Maximum reconnection attempts before showing a connection error. */
export const DISPLAY_MAX_RECONNECT_ATTEMPTS: number = 5;

/** @brief Duration (ms) the PASS screen stays visible before returning to IDLE. */
export const DISPLAY_PASS_TIMEOUT_MS: number = 5000;

/** @brief Duration (ms) the FAIL screen stays visible before returning to IDLE. */
export const DISPLAY_FAIL_TIMEOUT_MS: number = 5000;

/** @brief Duration (ms) the UNKNOWN_CARD screen stays visible before returning to IDLE. */
export const DISPLAY_UNKNOWN_CARD_TIMEOUT_MS: number = 4000;

/* ================================================================== */
/*  Enums                                                             */
/* ================================================================== */

/**
 * @brief Display states — mirrors the system state machine on MOD-03.
 *
 * MOD-03 (RPi) runs the state machine and pushes each transition to
 * this display module over WebSocket.
 *
 * State transitions:
 *   IDLE  ──(card scanned)──▶  IDENTIFYING
 *   IDENTIFYING ──(worker found)──▶  INSPECTING
 *   IDENTIFYING ──(unknown card)──▶  UNKNOWN_CARD  ──(timeout)──▶  IDLE
 *   INSPECTING  ──(all PPE present)──▶  PASS  ──(timeout)──▶  IDLE
 *   INSPECTING  ──(PPE missing)──▶  FAIL  ──(timeout)──▶  IDLE
 *
 *   CONNECTION_ERROR is a local-only state shown when the WebSocket
 *   connection to MOD-03 is lost.
 */
export enum DisplayState {
  /** No worker present — show "Scan your card" animation */
  IDLE = "IDLE",

  /** RFID card scanned — MOD-03 querying MOD-04 backend for worker info */
  IDENTIFYING = "IDENTIFYING",

  /** Card not found in backend database */
  UNKNOWN_CARD = "UNKNOWN_CARD",

  /** Worker identified — AI inference (MOD-01) running on RPi */
  INSPECTING = "INSPECTING",

  /** All required PPE detected — access granted, gate opens */
  PASS = "PASS",

  /** Missing PPE detected — access denied, gate stays locked */
  FAIL = "FAIL",

  /** WebSocket connection to MOD-03 lost (local state) */
  CONNECTION_ERROR = "CONNECTION_ERROR",
}

/**
 * @brief WebSocket connection status.
 */
export enum ConnectionStatus {
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  DISCONNECTED = "DISCONNECTED",
  RECONNECTING = "RECONNECTING",
  FAILED = "FAILED",
}

/* ================================================================== */
/*  Data Types — Incoming Messages (MOD-03 RPi → Display)             */
/* ================================================================== */

/**
 * @brief Base interface for all WebSocket messages received from MOD-03.
 *
 * Every message pushed by MOD-03 contains at least a `state` field
 * that determines which screen the display should render.
 */
export interface DisplayMessageBase {
  /** Current system state — determines which screen to show */
  state: DisplayState;
  /** Server-side timestamp (ISO 8601) from MOD-03 */
  timestamp?: string;
}

/**
 * @brief IDLE state message — no additional data needed.
 *
 * Received when:
 *   - System resets after a completed inspection cycle
 *   - Gate closes after passage
 *   - Timeout on any terminal state
 */
export interface DisplayMessageIdle extends DisplayMessageBase {
  state: DisplayState.IDLE;
}

/**
 * @brief IDENTIFYING state message — card scanned, backend lookup in progress.
 *
 * Received when: RFID card is scanned at the turnstile, MOD-03 sends
 * HTTP request to MOD-04 for worker lookup.
 * Display action: Show loading/identifying animation.
 */
export interface DisplayMessageIdentifying extends DisplayMessageBase {
  state: DisplayState.IDENTIFYING;
  /** The scanned RFID card UID (optional, for display/debug purposes) */
  rfid_card_uid?: string;
}

/**
 * @brief UNKNOWN_CARD state message — card not found in database.
 *
 * Received when: MOD-04 returns 404 for the scanned card UID.
 * Display action: Show "Access Denied — Unregistered Card" screen.
 *
 * Maps to MOD-04 EntryResult "UNKNOWN_CARD".
 */
export interface DisplayMessageUnknownCard extends DisplayMessageBase {
  state: DisplayState.UNKNOWN_CARD;
  /** The scanned RFID UID that was not found */
  rfid_card_uid?: string;
}

/**
 * @brief INSPECTING state message — PPE check in progress.
 *
 * Received when: MOD-03 identifies the worker via MOD-04's
 * WorkerCardLookup and starts AI inference (MOD-01).
 * Display action: Show worker info + instructions ("Please raise your
 *                 hands and face the camera").
 *
 * Worker fields mirror MOD-04's WorkerCardLookupResponse.data.worker.
 * PPE fields mirror MOD-04's WorkerCardLookupResponse.data.required_ppe.
 * Both are fetched by MOD-03 from MOD-04 and forwarded here.
 */
export interface DisplayMessageInspecting extends DisplayMessageBase {
  state: DisplayState.INSPECTING;
  /** Worker identity (fetched by MOD-03 from MOD-04 backend) */
  worker: {
    id: number;
    full_name: string;
    photo_url: string | null;
    role_name: string;
  };
  /** List of PPE items required for this worker's role */
  required_ppe: RequiredPpeItem[];
  /** Instruction text to show the worker (e.g. "Please raise your hands") */
  instruction?: string;
}

/**
 * @brief PASS state message — all required PPE detected, access granted.
 *
 * Received when: MOD-03 confirms (via MOD-01 AI) that all required
 * PPE items are present. Gate opens (MOD-02).
 * Display action: Show green "Access Granted" screen with welcome message.
 *
 * Maps to MOD-04 EntryResult "PASS".
 */
export interface DisplayMessagePass extends DisplayMessageBase {
  state: DisplayState.PASS;
  /** Worker identity */
  worker: {
    id: number;
    full_name: string;
    photo_url: string | null;
    role_name: string;
  };
  /** List of PPE items that were detected on the worker */
  detected_ppe: RequiredPpeItem[];
}

/**
 * @brief FAIL state message — one or more required PPE items missing.
 *
 * Received when: MOD-03 determines (via MOD-01 AI) that required PPE
 * items are absent. Gate stays locked (MOD-02).
 * Display action: Show red "Access Denied" screen with missing item list.
 *
 * Maps to MOD-04 EntryResult "FAIL".
 */
export interface DisplayMessageFail extends DisplayMessageBase {
  state: DisplayState.FAIL;
  /** Worker identity */
  worker: {
    id: number;
    full_name: string;
    photo_url: string | null;
    role_name: string;
  };
  /** List of PPE items that were successfully detected */
  detected_ppe: RequiredPpeItem[];
  /** List of PPE items that are required but were NOT detected */
  missing_ppe: RequiredPpeItem[];
}

/**
 * @brief Union type of all possible incoming display messages.
 *
 * Use the `state` field as the discriminator to narrow the type:
 *
 * ```typescript
 * function handleMessage(msg: DisplayMessage): void {
 *   switch (msg.state) {
 *     case DisplayState.IDLE:
 *       // msg is DisplayMessageIdle
 *       break;
 *     case DisplayState.INSPECTING:
 *       // msg is DisplayMessageInspecting
 *       console.log(msg.worker.full_name, msg.required_ppe);
 *       break;
 *     case DisplayState.FAIL:
 *       // msg is DisplayMessageFail
 *       console.log(msg.missing_ppe);
 *       break;
 *     // ...
 *   }
 * }
 * ```
 */
export type DisplayMessage =
  | DisplayMessageIdle
  | DisplayMessageIdentifying
  | DisplayMessageUnknownCard
  | DisplayMessageInspecting
  | DisplayMessagePass
  | DisplayMessageFail;

/* ================================================================== */
/*  Data Types — Outgoing Messages (Display → MOD-03 RPi)             */
/* ================================================================== */

/**
 * @brief Acknowledgement message sent from display to MOD-03.
 *
 * The display sends this message to confirm it has received and rendered
 * a state transition. This allows MOD-03 to track whether the display
 * is alive and responsive.
 */
export interface DisplayAckMessage {
  /** Message type identifier */
  type: "DISPLAY_ACK";
  /** The state that was received and rendered */
  acknowledged_state: DisplayState;
  /** Client-side timestamp (ISO 8601) */
  timestamp: string;
}

/**
 * @brief Status message sent from display to MOD-03 on connection.
 *
 * Sent once when the WebSocket connection is established, so MOD-03
 * knows the display is online and ready to receive events.
 */
export interface DisplayReadyMessage {
  /** Message type identifier */
  type: "DISPLAY_READY";
  /** Client identifier (e.g. "turnstile-display-01") */
  client_id: string;
  /** Client-side timestamp (ISO 8601) */
  timestamp: string;
}

/**
 * @brief Union type of all outgoing messages from the display.
 */
export type DisplayOutgoingMessage = DisplayAckMessage | DisplayReadyMessage;

/* ================================================================== */
/*  WebSocket Client Interface                                        */
/* ================================================================== */

/**
 * @brief Callback type for incoming display state messages.
 * @param message  The parsed DisplayMessage received from MOD-03.
 */
export type OnDisplayMessageCallback = (message: DisplayMessage) => void;

/**
 * @brief Callback type for WebSocket connection status changes.
 * @param status  The new connection status.
 */
export type OnConnectionStatusCallback = (status: ConnectionStatus) => void;

/**
 * @brief WebSocket client configuration.
 */
export interface DisplayWSConfig {
  /** Full WebSocket URL on the RPi (e.g. "ws://192.168.1.100:8080/ws/display") */
  server_url: string;
  /** Reconnection interval in ms (default: DISPLAY_RECONNECT_INTERVAL_MS) */
  reconnect_interval_ms?: number;
  /** Max reconnection attempts (default: DISPLAY_MAX_RECONNECT_ATTEMPTS) */
  max_reconnect_attempts?: number;
  /** Client identifier sent in DISPLAY_READY message */
  client_id?: string;
}

/**
 * @brief Public interface for the WebSocket client module.
 *
 * This interface defines the contract for the WebSocket client that
 * connects the turnstile display to the Raspberry Pi (MOD-03). The
 * implementation manages connection lifecycle, automatic reconnection,
 * and message parsing.
 */
export interface IDisplayWSClient {
  /**
   * @brief Open a WebSocket connection to MOD-03 (RPi).
   * @param config  Connection configuration.
   * @return void
   *
   * On successful connection, sends a DISPLAY_READY message to MOD-03
   * and begins listening for DisplayMessage events.
   */
  connect(config: DisplayWSConfig): void;

  /**
   * @brief Close the WebSocket connection gracefully.
   * @return void
   *
   * Stops any pending reconnection attempts and closes the socket.
   */
  disconnect(): void;

  /**
   * @brief Register a callback for incoming display messages.
   * @param callback  Function invoked on each received DisplayMessage.
   * @return void
   */
  onMessage(callback: OnDisplayMessageCallback): void;

  /**
   * @brief Register a callback for connection status changes.
   * @param callback  Function invoked when connection status changes.
   * @return void
   */
  onConnectionStatus(callback: OnConnectionStatusCallback): void;

  /**
   * @brief Send an acknowledgement to MOD-03.
   * @param state  The DisplayState that was successfully rendered.
   * @return void
   */
  sendAck(state: DisplayState): void;

  /**
   * @brief Get the current connection status.
   * @return Current ConnectionStatus value.
   */
  getStatus(): ConnectionStatus;
}

/* ================================================================== */
/*  Display Controller Interface                                      */
/* ================================================================== */

/**
 * @brief Public interface for the Display Controller.
 *
 * The Display Controller manages the screen rendering logic. It receives
 * parsed DisplayMessage objects and determines which UI screen to render,
 * handles transition animations, and manages auto-return timers
 * (e.g., returning to IDLE after PASS timeout).
 */
export interface IDisplayController {
  /**
   * @brief Initialize the display controller.
   * @return void
   *
   * Sets up the initial IDLE state, registers screen components,
   * and prepares transition animations.
   */
  init(): void;

  /**
   * @brief Process an incoming state message and update the display.
   * @param message  The DisplayMessage received from MOD-03 via WebSocket.
   * @return void
   *
   * This is the main entry point for state transitions. The controller
   * validates the transition, updates the internal state, and triggers
   * the appropriate screen render with animations.
   */
  handleMessage(message: DisplayMessage): void;

  /**
   * @brief Get the current display state.
   * @return The currently active DisplayState.
   */
  getCurrentState(): DisplayState;

  /**
   * @brief Force-reset the display to IDLE state.
   * @return void
   *
   * Used for error recovery or manual reset. Cancels any active timers
   * and transitions directly to the IDLE screen.
   */
  resetToIdle(): void;
}

/* ================================================================== */
/*  Mock API Interface (for development / testing)                    */
/* ================================================================== */

/**
 * @brief Mock scenario identifiers for testing without MOD-03 running.
 */
export enum MockScenario {
  /** Simulate a registered worker with all PPE → PASS */
  PASS_FLOW = "PASS_FLOW",
  /** Simulate a registered worker with missing PPE → FAIL */
  FAIL_FLOW = "FAIL_FLOW",
  /** Simulate an unregistered RFID card → UNKNOWN_CARD */
  UNKNOWN_CARD_FLOW = "UNKNOWN_CARD_FLOW",
}

/**
 * @brief Interface for the mock event simulator.
 *
 * During development, this module replaces the real WebSocket connection
 * to MOD-03 and fires a sequence of DisplayMessage events to simulate
 * the full inspection flow. This allows UI testing independently.
 */
export interface IMockEventSimulator {
  /**
   * @brief Run a predefined test scenario.
   * @param scenario  Which scenario to simulate.
   * @param callback  Function called for each simulated DisplayMessage.
   * @return void
   *
   * The simulator fires messages in sequence with realistic delays:
   *   1. IDENTIFYING  (immediate)
   *   2. INSPECTING or UNKNOWN_CARD  (after ~1.5s)
   *   3. PASS or FAIL  (after ~3s)
   *   4. IDLE  (after timeout)
   */
  runScenario(
    scenario: MockScenario,
    callback: OnDisplayMessageCallback
  ): void;

  /**
   * @brief Stop the currently running scenario and reset.
   * @return void
   */
  stopScenario(): void;
}
