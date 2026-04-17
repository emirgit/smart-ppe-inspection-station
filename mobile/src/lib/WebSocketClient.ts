import {
  DisplayWSConfig,
  IDisplayWSClient,
  OnDisplayMessageCallback,
  OnConnectionStatusCallback,
  ConnectionStatus,
  DisplayState,
  DisplayMessage,
} from "../interfaces/display_interface";

export class WebSocketClient implements IDisplayWSClient {
  private ws: WebSocket | null = null;
  private config: DisplayWSConfig | null = null;
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private onMessageCb: OnDisplayMessageCallback | null = null;
  private onStatusCb: OnConnectionStatusCallback | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: number | undefined = undefined;

  connect(config: DisplayWSConfig): void {
    this.config = config;
    this.attemptConnection();
  }

  private attemptConnection() {
    if (!this.config || this.reconnectAttempts >= (this.config.max_reconnect_attempts || 5)) {
      this.updateStatus(ConnectionStatus.FAILED);
      return;
    }

    this.updateStatus(ConnectionStatus.CONNECTING);
    try {
      this.ws = new WebSocket(this.config.server_url);

      this.ws.onopen = () => {
        this.updateStatus(ConnectionStatus.CONNECTED);
        this.reconnectAttempts = 0;
        
        const readyMsg = {
          type: "DISPLAY_READY",
          client_id: this.config?.client_id || "mobile-display",
          timestamp: new Date().toISOString()
        };
        this.ws?.send(JSON.stringify(readyMsg));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: DisplayMessage = JSON.parse(event.data);
          if (this.onMessageCb) {
            this.onMessageCb(msg);
          }
        } catch (e) {
          console.error("Failed to parse websocket message", e);
        }
      };

      this.ws.onclose = () => {
        this.updateStatus(ConnectionStatus.DISCONNECTED);
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.updateStatus(ConnectionStatus.FAILED);
      };
    } catch (err) {
      this.updateStatus(ConnectionStatus.FAILED);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts < (this.config?.max_reconnect_attempts || 5)) {
      this.reconnectAttempts++;
      this.updateStatus(ConnectionStatus.RECONNECTING);
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = window.setTimeout(
        () => this.attemptConnection(),
        this.config?.reconnect_interval_ms || 3000
      );
    }
  }

  disconnect(): void {
    clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.updateStatus(ConnectionStatus.DISCONNECTED);
  }

  onMessage(callback: OnDisplayMessageCallback): void {
    this.onMessageCb = callback;
  }

  onConnectionStatus(callback: OnConnectionStatusCallback): void {
    this.onStatusCb = callback;
  }

  sendAck(state: DisplayState): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const ackMsg = {
        type: "DISPLAY_ACK",
        acknowledged_state: state,
        timestamp: new Date().toISOString()
      };
      this.ws.send(JSON.stringify(ackMsg));
    }
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  private updateStatus(status: ConnectionStatus) {
    this.status = status;
    if (this.onStatusCb) {
      this.onStatusCb(status);
    }
  }
}
