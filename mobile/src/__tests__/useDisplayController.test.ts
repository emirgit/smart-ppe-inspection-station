/**
 * @file    useDisplayController.test.ts
 * @brief   State machine unit tests SM-01 through SM-10
 *          (see doc/knowledge.md → Unit Tests Required).
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDisplayController } from '../hooks/useDisplayController';
import {
  ConnectionStatus,
  DISPLAY_FAIL_TIMEOUT_MS,
  DISPLAY_PASS_TIMEOUT_MS,
  DISPLAY_UNKNOWN_CARD_TIMEOUT_MS,
  DisplayState,
} from '../interfaces/display_interface';

const sampleWorker = {
  id: 1,
  full_name: 'Ahmet Yılmaz',
  photo_url: null,
  role_name: 'Technician',
} as const;

const samplePpe = [
  { id: 1, item_key: 'hard_hat', display_name: 'Hard Hat', icon_name: 'hard_hat' },
];

describe('useDisplayController state machine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('SM-01: initial state is IDLE', () => {
    const { result } = renderHook(() => useDisplayController());
    expect(result.current.state).toBe(DisplayState.IDLE);
  });

  it('SM-02: transitions IDLE → IDENTIFYING on IDENTIFYING message', () => {
    const { result } = renderHook(() => useDisplayController());
    act(() => {
      result.current.handleRawMessage({
        state: 'IDENTIFYING',
        rfid_card_uid: 'A3F2C1D4',
      });
    });
    expect(result.current.state).toBe(DisplayState.IDENTIFYING);
  });

  it('SM-03: transitions IDENTIFYING → INSPECTING with worker payload', () => {
    const { result } = renderHook(() => useDisplayController());
    act(() => {
      result.current.handleRawMessage({ state: 'IDENTIFYING' });
    });
    act(() => {
      result.current.handleRawMessage({
        state: 'INSPECTING',
        worker: sampleWorker,
        required_ppe: samplePpe,
        instruction: 'Face the camera',
      });
    });
    expect(result.current.state).toBe(DisplayState.INSPECTING);
    if (result.current.message?.state !== DisplayState.INSPECTING) {
      throw new Error('expected INSPECTING message');
    }
    expect(result.current.message.worker.full_name).toBe('Ahmet Yılmaz');
    expect(result.current.message.required_ppe).toHaveLength(1);
  });

  it('SM-04: transitions IDENTIFYING → UNKNOWN_CARD', () => {
    const { result } = renderHook(() => useDisplayController());
    act(() => {
      result.current.handleRawMessage({ state: 'IDENTIFYING' });
    });
    act(() => {
      result.current.handleRawMessage({
        state: 'UNKNOWN_CARD',
        rfid_card_uid: 'A3F2C1D4',
      });
    });
    expect(result.current.state).toBe(DisplayState.UNKNOWN_CARD);
  });

  it('SM-05: transitions INSPECTING → PASS (also accepts GRANTED alias)', () => {
    const { result } = renderHook(() => useDisplayController());
    act(() => {
      result.current.handleRawMessage({
        state: 'GRANTED',
        worker: sampleWorker,
        detected_ppe: samplePpe,
      });
    });
    expect(result.current.state).toBe(DisplayState.PASS);
  });

  it('SM-06: transitions INSPECTING → FAIL (also accepts DENIED alias)', () => {
    const { result } = renderHook(() => useDisplayController());
    act(() => {
      result.current.handleRawMessage({
        state: 'DENIED',
        worker: sampleWorker,
        detected_ppe: [],
        missing_ppe: samplePpe,
      });
    });
    expect(result.current.state).toBe(DisplayState.FAIL);
  });

  it('SM-07: returns to IDLE after DISPLAY_PASS_TIMEOUT_MS', () => {
    const { result } = renderHook(() => useDisplayController());
    act(() => {
      result.current.handleRawMessage({
        state: 'PASS',
        worker: sampleWorker,
        detected_ppe: samplePpe,
      });
    });
    expect(result.current.state).toBe(DisplayState.PASS);
    act(() => {
      vi.advanceTimersByTime(DISPLAY_PASS_TIMEOUT_MS);
    });
    expect(result.current.state).toBe(DisplayState.IDLE);
  });

  it('SM-08: returns to IDLE after DISPLAY_FAIL_TIMEOUT_MS', () => {
    const { result } = renderHook(() => useDisplayController());
    act(() => {
      result.current.handleRawMessage({
        state: 'FAIL',
        worker: sampleWorker,
        detected_ppe: [],
        missing_ppe: samplePpe,
      });
    });
    act(() => {
      vi.advanceTimersByTime(DISPLAY_FAIL_TIMEOUT_MS);
    });
    expect(result.current.state).toBe(DisplayState.IDLE);
  });

  it('SM-09: returns to IDLE after DISPLAY_UNKNOWN_CARD_TIMEOUT_MS', () => {
    const { result } = renderHook(() => useDisplayController());
    act(() => {
      result.current.handleRawMessage({ state: 'UNKNOWN_CARD' });
    });
    act(() => {
      vi.advanceTimersByTime(DISPLAY_UNKNOWN_CARD_TIMEOUT_MS);
    });
    expect(result.current.state).toBe(DisplayState.IDLE);
  });

  it('SM-10: keeps state and warns on unknown state strings', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useDisplayController());
    act(() => {
      result.current.handleRawMessage({ state: 'BOGUS' });
    });
    expect(result.current.state).toBe(DisplayState.IDLE);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('moves into CONNECTION_ERROR when connection is reported as FAILED', () => {
    const { result } = renderHook(() => useDisplayController());
    act(() => {
      result.current.setConnection(ConnectionStatus.FAILED);
    });
    expect(result.current.state).toBe(DisplayState.CONNECTION_ERROR);
    act(() => {
      result.current.setConnection(ConnectionStatus.CONNECTED);
    });
    expect(result.current.state).toBe(DisplayState.IDLE);
  });

  it('invokes onStateRendered after each accepted message', () => {
    const onStateRendered = vi.fn();
    const { result } = renderHook(() =>
      useDisplayController({ onStateRendered })
    );
    act(() => {
      result.current.handleRawMessage({ state: 'IDENTIFYING' });
    });
    expect(onStateRendered).toHaveBeenCalledWith(DisplayState.IDENTIFYING);
  });
});
