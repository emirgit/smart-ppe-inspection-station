/**
 * @file    useDisplayController.ts
 * @brief   React hook implementing the IDisplayController contract.
 *
 * Owns the active DisplayState, the last DisplayMessage, and the
 * auto-return timer that brings the screen back to IDLE after a
 * terminal state (PASS, FAIL, UNKNOWN_CARD).
 *
 * The MOD-03 Raspberry Pi normally pushes IDLE itself once the gate
 * cycle completes, but the timer is a local safety net so the kiosk
 * never gets stuck on a terminal screen if the IDLE message is lost.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConnectionStatus,
  DisplayState,
  DISPLAY_FAIL_TIMEOUT_MS,
  DISPLAY_PASS_TIMEOUT_MS,
  DISPLAY_UNKNOWN_CARD_TIMEOUT_MS,
  type DisplayMessage,
} from '../interfaces/display_interface';
import { normalizeMessage } from '../lib/normalize';

const TERMINAL_TIMEOUTS: Partial<Record<DisplayState, number>> = {
  [DisplayState.PASS]: DISPLAY_PASS_TIMEOUT_MS,
  [DisplayState.FAIL]: DISPLAY_FAIL_TIMEOUT_MS,
  [DisplayState.UNKNOWN_CARD]: DISPLAY_UNKNOWN_CARD_TIMEOUT_MS,
};

export interface DisplayControllerOptions {
  /**
   * Callback fired after the controller has accepted and stored a new
   * normalized state. Use this to send a DISPLAY_ACK to MOD-03.
   */
  onStateRendered?: (state: DisplayState) => void;
}

export interface DisplayControllerApi {
  state: DisplayState;
  message: DisplayMessage | null;
  connection: ConnectionStatus;
  setConnection: (status: ConnectionStatus) => void;
  handleRawMessage: (raw: unknown) => void;
  handleMessage: (msg: DisplayMessage) => void;
  resetToIdle: () => void;
}

const IDLE_MESSAGE: DisplayMessage = { state: DisplayState.IDLE };

export function useDisplayController(
  options: DisplayControllerOptions = {}
): DisplayControllerApi {
  const { onStateRendered } = options;
  const [state, setState] = useState<DisplayState>(DisplayState.IDLE);
  const [message, setMessage] = useState<DisplayMessage | null>(IDLE_MESSAGE);
  const [connection, setConnectionState] = useState<ConnectionStatus>(
    ConnectionStatus.DISCONNECTED
  );
  const timerRef = useRef<number | null>(null);
  const onStateRenderedRef = useRef(onStateRendered);

  useEffect(() => {
    onStateRenderedRef.current = onStateRendered;
  }, [onStateRendered]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const applyMessage = useCallback(
    (msg: DisplayMessage) => {
      clearTimer();
      setState(msg.state);
      setMessage(msg);
      onStateRenderedRef.current?.(msg.state);

      const timeout = TERMINAL_TIMEOUTS[msg.state];
      if (typeof timeout === 'number') {
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          setState(DisplayState.IDLE);
          setMessage(IDLE_MESSAGE);
          onStateRenderedRef.current?.(DisplayState.IDLE);
        }, timeout);
      }
    },
    [clearTimer]
  );

  const handleRawMessage = useCallback(
    (raw: unknown) => {
      const normalized = normalizeMessage(raw);
      if (!normalized) return;
      applyMessage(normalized);
    },
    [applyMessage]
  );

  const handleMessage = useCallback(
    (msg: DisplayMessage) => applyMessage(msg),
    [applyMessage]
  );

  const setConnection = useCallback(
    (status: ConnectionStatus) => {
      setConnectionState(status);
      if (status === ConnectionStatus.FAILED) {
        clearTimer();
        setState(DisplayState.CONNECTION_ERROR);
        setMessage(null);
      } else if (status === ConnectionStatus.CONNECTED) {
        // When the link recovers we drop back to IDLE so the operator
        // is not stuck on the CONNECTION_ERROR screen.
        if (state === DisplayState.CONNECTION_ERROR) {
          setState(DisplayState.IDLE);
          setMessage(IDLE_MESSAGE);
        }
      }
    },
    [clearTimer, state]
  );

  const resetToIdle = useCallback(() => {
    clearTimer();
    setState(DisplayState.IDLE);
    setMessage(IDLE_MESSAGE);
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return {
    state,
    message,
    connection,
    setConnection,
    handleRawMessage,
    handleMessage,
    resetToIdle,
  };
}
