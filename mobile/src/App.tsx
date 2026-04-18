/**
 * @file    App.tsx
 * @brief   Top-level component that wires the WebSocket client (or
 *          MockSimulator), the IDisplayController state machine, and
 *          the seven turnstile screens together.
 *
 * The component renders exactly one screen at a time based on the
 * active DisplayState. A small connection badge is always overlaid so
 * the on-site operator knows whether the link to the Raspberry Pi is
 * healthy.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ConnectionBadge } from './components/ConnectionBadge';
import { MockControls } from './components/MockControls';
import {
  ConnectionStatus,
  DisplayState,
  type DisplayMessageFail,
  type DisplayMessageInspecting,
  type DisplayMessagePass,
  type DisplayMessageUnknownCard,
  MockScenario,
} from './interfaces/display_interface';
import { useDisplayController } from './hooks/useDisplayController';
import { MockSimulator } from './lib/MockSimulator';
import { WebSocketClient } from './lib/WebSocketClient';
import {
  ConnectionErrorScreen,
  DeniedScreen,
  GrantedScreen,
  IdentifyingScreen,
  IdleScreen,
  InspectingScreen,
  UnknownCardScreen,
} from './screens/Screens';

interface AppRuntime {
  mock: boolean;
  serverUrl: string;
  clientId: string;
}

function readRuntime(): AppRuntime {
  const env = import.meta.env;
  const params =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const mockFromEnv = String(env.VITE_MOCK_MODE ?? '').toLowerCase() === 'true';
  const mockFromParam = ['1', 'true', 'yes'].includes(
    (params.get('mock') ?? '').toLowerCase()
  );
  return {
    mock: mockFromEnv || mockFromParam,
    serverUrl:
      typeof env.VITE_WS_URL === 'string' && env.VITE_WS_URL.length > 0
        ? env.VITE_WS_URL
        : 'ws://localhost:8080/ws/display',
    clientId:
      typeof env.VITE_CLIENT_ID === 'string' && env.VITE_CLIENT_ID.length > 0
        ? env.VITE_CLIENT_ID
        : 'turnstile-display-01',
  };
}

export default function App() {
  const runtime = useMemo(readRuntime, []);

  const wsClientRef = useRef<WebSocketClient | null>(null);
  if (wsClientRef.current === null) {
    wsClientRef.current = new WebSocketClient();
  }
  const mockSimulatorRef = useRef<MockSimulator | null>(null);
  if (mockSimulatorRef.current === null) {
    mockSimulatorRef.current = new MockSimulator();
  }

  const sendAck = useCallback((state: DisplayState) => {
    if (state === DisplayState.CONNECTION_ERROR) return;
    wsClientRef.current?.sendAck(state);
  }, []);

  const controller = useDisplayController({
    onStateRendered: runtime.mock ? undefined : sendAck,
  });

  const setConnection = controller.setConnection;
  const handleMessage = controller.handleMessage;
  useEffect(() => {
    if (runtime.mock) {
      setConnection(ConnectionStatus.CONNECTED);
      return;
    }
    const ws = wsClientRef.current!;
    ws.onConnectionStatus(setConnection);
    ws.onMessage(handleMessage);
    ws.connect({
      server_url: runtime.serverUrl,
      client_id: runtime.clientId,
    });
    return () => ws.disconnect();
  }, [
    handleMessage,
    setConnection,
    runtime.clientId,
    runtime.mock,
    runtime.serverUrl,
  ]);

  const runMock = useCallback(
    (scenario: MockScenario) => {
      mockSimulatorRef.current?.runScenario(scenario, controller.handleMessage);
    },
    [controller.handleMessage]
  );

  const resetMock = useCallback(() => {
    mockSimulatorRef.current?.stopScenario();
    controller.resetToIdle();
  }, [controller]);

  const screen = renderScreen(controller.state, controller.message);

  return (
    <div className="relative w-full h-full">
      <ConnectionBadge status={controller.connection} mock={runtime.mock} />
      {screen}
      {runtime.mock ? (
        <MockControls onRun={runMock} onReset={resetMock} />
      ) : null}
    </div>
  );
}

function renderScreen(
  state: DisplayState,
  message: ReturnType<typeof useDisplayController>['message']
) {
  switch (state) {
    case DisplayState.IDLE:
      return <IdleScreen />;
    case DisplayState.IDENTIFYING:
      return <IdentifyingScreen />;
    case DisplayState.UNKNOWN_CARD:
      return (
        <UnknownCardScreen
          message={
            message?.state === DisplayState.UNKNOWN_CARD
              ? (message as DisplayMessageUnknownCard)
              : null
          }
        />
      );
    case DisplayState.INSPECTING:
      if (message?.state !== DisplayState.INSPECTING) return <IdleScreen />;
      return <InspectingScreen message={message as DisplayMessageInspecting} />;
    case DisplayState.PASS:
      if (message?.state !== DisplayState.PASS) return <IdleScreen />;
      return <GrantedScreen message={message as DisplayMessagePass} />;
    case DisplayState.FAIL:
      if (message?.state !== DisplayState.FAIL) return <IdleScreen />;
      return <DeniedScreen message={message as DisplayMessageFail} />;
    case DisplayState.CONNECTION_ERROR:
      return <ConnectionErrorScreen />;
  }
}
