/**
 * @file    WebSocketClient.test.ts
 * @brief   WebSocket client tests WS-01 through WS-04
 *          (see doc/knowledge.md → Unit Tests Required).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocketClient } from '../lib/WebSocketClient';
import {
  ConnectionStatus,
  DisplayState,
} from '../interfaces/display_interface';

interface MockSocket {
  url: string;
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  onopen?: () => void;
  onmessage?: (ev: { data: string }) => void;
  onclose?: () => void;
  onerror?: (ev: unknown) => void;
}

const OPEN = 1;

let lastSocket: MockSocket | null = null;
let socketsCreated: MockSocket[] = [];

function createMockWebSocketCtor() {
  const ctor = function (url: string): MockSocket {
    const socket: MockSocket = {
      url,
      readyState: 0,
      send: vi.fn(),
      close: vi.fn(),
    };
    socket.close = vi.fn(() => {
      socket.readyState = 3;
      socket.onclose?.();
    });
    lastSocket = socket;
    socketsCreated.push(socket);
    return socket;
  } as unknown as { new (url: string): MockSocket; OPEN: number };
  ctor.OPEN = OPEN;
  return ctor as unknown as typeof WebSocket;
}

describe('WebSocketClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    socketsCreated = [];
    lastSocket = null;
    globalThis.WebSocket = createMockWebSocketCtor();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function openMockSocket() {
    if (!lastSocket) throw new Error('No socket constructed yet');
    lastSocket.readyState = OPEN;
    lastSocket.onopen?.();
  }

  it('WS-01: sends DISPLAY_READY immediately after the socket opens', () => {
    const client = new WebSocketClient();
    client.connect({
      server_url: 'ws://test/ws/display',
      client_id: 'tablet-1',
    });
    openMockSocket();
    expect(lastSocket!.send).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(lastSocket!.send.mock.calls[0][0] as string);
    expect(sent.type).toBe('DISPLAY_READY');
    expect(sent.client_id).toBe('tablet-1');
  });

  it('WS-02: forwards a normalized DisplayMessage on valid JSON', () => {
    const client = new WebSocketClient();
    const onMessage = vi.fn();
    client.onMessage(onMessage);
    client.connect({ server_url: 'ws://test/ws/display' });
    openMockSocket();

    lastSocket!.onmessage?.({
      data: JSON.stringify({
        state: 'GRANTED',
        worker: {
          id: 1,
          full_name: 'Ahmet Yılmaz',
          photo_url: null,
          role_name: 'Technician',
        },
        detected_ppe: ['hard_hat'],
      }),
    });

    expect(onMessage).toHaveBeenCalledTimes(1);
    const msg = onMessage.mock.calls[0][0];
    expect(msg.state).toBe(DisplayState.PASS);
    expect(msg.detected_ppe[0].display_name).toBe('Hard Hat');
  });

  it('WS-03: ignores malformed JSON without crashing the callback', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = new WebSocketClient();
    const onMessage = vi.fn();
    client.onMessage(onMessage);
    client.connect({ server_url: 'ws://test/ws/display' });
    openMockSocket();

    lastSocket!.onmessage?.({ data: 'not-json' });

    expect(onMessage).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('WS-04: schedules a reconnect after the socket closes unexpectedly', () => {
    const client = new WebSocketClient();
    const onStatus = vi.fn();
    client.onConnectionStatus(onStatus);
    client.connect({
      server_url: 'ws://test/ws/display',
      reconnect_interval_ms: 3000,
      max_reconnect_attempts: 2,
    });
    openMockSocket();
    expect(client.getStatus()).toBe(ConnectionStatus.CONNECTED);

    lastSocket!.onclose?.();
    expect(client.getStatus()).toBe(ConnectionStatus.RECONNECTING);

    vi.advanceTimersByTime(3000);
    expect(socketsCreated.length).toBe(2);
  });

  it('sendAck does nothing when the socket is not OPEN', () => {
    const client = new WebSocketClient();
    client.connect({ server_url: 'ws://test/ws/display' });
    // socket has not opened yet
    client.sendAck(DisplayState.IDLE);
    expect(lastSocket!.send).not.toHaveBeenCalled();

    openMockSocket();
    lastSocket!.send.mockClear();
    client.sendAck(DisplayState.PASS);
    expect(lastSocket!.send).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(lastSocket!.send.mock.calls[0][0] as string);
    expect(sent.type).toBe('DISPLAY_ACK');
    expect(sent.acknowledged_state).toBe(DisplayState.PASS);
  });
});
