/**
 * @file    WebSocketClient.ts
 * @brief   IDisplayWSClient implementation backed by the browser
 *          native WebSocket API.
 *
 * Manages connection lifecycle, automatic reconnection with bounded
 * attempts, DISPLAY_READY handshake, and DISPLAY_ACK forwarding.
 */
import {
  ConnectionStatus,
  DISPLAY_MAX_RECONNECT_ATTEMPTS,
  DISPLAY_RECONNECT_INTERVAL_MS,
  DisplayState,
  type DisplayWSConfig,
  type IDisplayWSClient,
  type OnConnectionStatusCallback,
  type OnDisplayMessageCallback,
} from '../interfaces/display_interface';
import { normalizeMessage } from './normalize';

export class WebSocketClient implements IDisplayWSClient {
  private ws: WebSocket | null = null;
  private config: DisplayWSConfig | null = null;
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private onMessageCb: OnDisplayMessageCallback | null = null;
  private onStatusCb: OnConnectionStatusCallback | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: number | null = null;
  private intentionalClose = false;

  connect(config: DisplayWSConfig): void {
    this.config = config;
    this.intentionalClose = false;
    this.reconnectAttempts = 0;
    this.openSocket();
  }

  private openSocket(): void {
    if (!this.config) return;

    this.updateStatus(ConnectionStatus.CONNECTING);
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.config.server_url);
    } catch (err) {
      console.warn('[ws] Failed to construct WebSocket', err);
      this.scheduleReconnect();
      return;
    }
    this.ws = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.updateStatus(ConnectionStatus.CONNECTED);
      const readyMsg = {
        type: 'DISPLAY_READY' as const,
        client_id: this.config?.client_id ?? 'turnstile-display-01',
        timestamp: new Date().toISOString(),
      };
      this.safeSend(JSON.stringify(readyMsg));
    };

    socket.onmessage = (event) => {
      let payload: unknown;
      try {
        payload = JSON.parse(typeof event.data === 'string' ? event.data : '');
      } catch (err) {
        console.warn('[ws] Dropping malformed JSON frame:', err);
        return;
      }
      const normalized = normalizeMessage(payload);
      if (normalized && this.onMessageCb) {
        this.onMessageCb(normalized);
      }
    };

    socket.onclose = () => {
      this.ws = null;
      if (this.intentionalClose) {
        this.updateStatus(ConnectionStatus.DISCONNECTED);
        return;
      }
      this.scheduleReconnect();
    };

    socket.onerror = (event) => {
      console.warn('[ws] socket error', event);
    };
  }

  private scheduleReconnect(): void {
    const maxAttempts =
      this.config?.max_reconnect_attempts ?? DISPLAY_MAX_RECONNECT_ATTEMPTS;
    if (this.reconnectAttempts >= maxAttempts) {
      this.updateStatus(ConnectionStatus.FAILED);
      return;
    }
    this.reconnectAttempts += 1;
    this.updateStatus(ConnectionStatus.RECONNECTING);

    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
    }
    const interval =
      this.config?.reconnect_interval_ms ?? DISPLAY_RECONNECT_INTERVAL_MS;
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      this.openSocket();
    }, interval);
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (err) {
        console.warn('[ws] error closing socket', err);
      }
      this.ws = null;
    }
    this.updateStatus(ConnectionStatus.DISCONNECTED);
  }

  onMessage(callback: OnDisplayMessageCallback): void {
    this.onMessageCb = callback;
  }

  onConnectionStatus(callback: OnConnectionStatusCallback): void {
    this.onStatusCb = callback;
    callback(this.status);
  }

  sendAck(state: DisplayState): void {
    const ackMsg = {
      type: 'DISPLAY_ACK' as const,
      acknowledged_state: state,
      timestamp: new Date().toISOString(),
    };
    this.safeSend(JSON.stringify(ackMsg));
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  private safeSend(payload: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(payload);
      } catch (err) {
        console.warn('[ws] send failed', err);
      }
    }
  }

  private updateStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.onStatusCb?.(status);
  }
}
