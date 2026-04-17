import { useEffect, useState } from 'react';
import { ScanFace, Wifi, WifiOff } from 'lucide-react';
import { 
  DisplayState, 
  DisplayMessage, 
  ConnectionStatus,
  DISPLAY_PASS_TIMEOUT_MS,
  DISPLAY_FAIL_TIMEOUT_MS,
  DISPLAY_UNKNOWN_CARD_TIMEOUT_MS,
  MockScenario
} from '../interfaces/display_interface';
import { WebSocketClient } from '../lib/WebSocketClient';
import { MockSimulator } from '../lib/MockSimulator';

const wsClient = new WebSocketClient();
const mockSimulator = new MockSimulator();

export default function App() {
  const [state, setState] = useState<DisplayState>(DisplayState.IDLE);
  const [connection, setConnection] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [message, setMessage] = useState<DisplayMessage | null>(null);

  useEffect(() => {
    // In real env, connect via wsClient. For development, we use MockSimulator.
    // Uncomment for real connect:
    /*
    wsClient.onConnectionStatus(setConnection);
    wsClient.onMessage(handleMessage);
    wsClient.connect({
       server_url: "ws://localhost:8080/ws/display", 
       client_id: "display-01" 
    });
    return () => wsClient.disconnect();
    */
    setConnection(ConnectionStatus.CONNECTED); // mock
  }, []);

  const handleMessage = (msg: DisplayMessage) => {
    setMessage(msg);
    setState(msg.state);
    
    // Ack back
    // wsClient.sendAck(msg.state);

    // Handle Timeouts locally purely as safety fallback, UI relies on Server to send IDLE.
    // Though as per our interface, usually logic is on RPi. We will just render what receives.
  };

  const runMock = (scenario: MockScenario) => {
    mockSimulator.runScenario(scenario, handleMessage);
  };

  const renderScreen = () => {
    switch (state) {
      case DisplayState.IDLE:
        return (
          <div className="flex flex-col items-center justify-center space-y-6 animate-pulse">
            <ScanFace size={120} className="text-blue-500" />
            <h1 className="text-4xl font-bold">Please Scan Your valid RFID ID Card</h1>
          </div>
        );
      case DisplayState.IDENTIFYING:
        return (
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="w-24 h-24 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
            <h1 className="text-4xl font-bold">Verifying Identity...</h1>
          </div>
        );
      case DisplayState.UNKNOWN_CARD:
        return (
          <div className="flex flex-col items-center justify-center space-y-6 bg-red-900/40 p-12 rounded-3xl border border-red-500">
            <h1 className="text-5xl font-bold text-red-500">Access Denied</h1>
            <p className="text-2xl">Unregistered Card</p>
          </div>
        );
      case DisplayState.INSPECTING:
        if (message?.state !== DisplayState.INSPECTING) return null;
        return (
          <div className="flex flex-col items-center justify-center w-full max-w-4xl space-y-8 bg-slate-800 p-10 rounded-3xl">
            <h2 className="text-3xl font-bold text-yellow-400">Inspecting PPE...</h2>
            <div className="text-xl text-gray-300">Evaluating {message.worker.full_name} ({message.worker.role_name})</div>
            <div className="text-2xl mt-4 bg-slate-700 w-full text-center p-4 rounded-xl shadow-inner">
               {message.instruction || "Please look at the camera and hold still"}
            </div>
            <div className="flex gap-4 mt-6">
              {message.required_ppe.map((ppe) => (
                <div key={ppe.id} className="bg-slate-600 p-4 rounded text-center">
                  <div className="text-lg font-semibold">{ppe.display_name}</div>
                </div>
              ))}
            </div>
          </div>
        );
      case DisplayState.PASS:
        if (message?.state !== DisplayState.PASS) return null;
        return (
          <div className="flex flex-col items-center justify-center w-full max-w-4xl space-y-8 bg-green-900/40 p-12 rounded-3xl border border-green-500">
            <h1 className="text-6xl font-bold text-green-400">ACCESS GRANTED</h1>
            <p className="text-3xl">Welcome, {message.worker.full_name}</p>
            <p className="text-xl text-green-200 mt-4">Gate opens automatically. Proceed safely.</p>
          </div>
        );
      case DisplayState.FAIL:
        if (message?.state !== DisplayState.FAIL) return null;
        return (
          <div className="flex flex-col items-center justify-center w-full max-w-4xl space-y-8 bg-red-900/40 p-12 rounded-3xl border border-red-500">
            <h1 className="text-6xl font-bold text-red-500">ACCESS DENIED</h1>
            <p className="text-3xl">Missing Required PPE for {message.worker.full_name}</p>
            <div className="grid grid-cols-2 gap-4 mt-8">
              {message.missing_ppe.map((ppe) => (
                <div key={ppe.id} className="bg-red-800/80 p-4 rounded-xl border border-red-400">
                   {ppe.display_name} Missing
                </div>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 relative">
      <div className="absolute top-4 right-4 flex items-center space-x-2">
        {connection === ConnectionStatus.CONNECTED ? (
          <Wifi className="text-green-500" />
        ) : (
          <WifiOff className="text-red-500" />
        )}
        <span className="text-sm font-semibold">{connection}</span>
      </div>

      {renderScreen()}

      {/* Dev Controls */}
      <div className="absolute bottom-4 left-4 flex gap-4">
        <button onClick={() => runMock(MockScenario.PASS_FLOW)} className="bg-slate-700 px-4 py-2 rounded text-sm hover:bg-slate-600 transition">Test: Pass</button>
        <button onClick={() => runMock(MockScenario.FAIL_FLOW)} className="bg-slate-700 px-4 py-2 rounded text-sm hover:bg-slate-600 transition">Test: Fail</button>
        <button onClick={() => runMock(MockScenario.UNKNOWN_CARD_FLOW)} className="bg-slate-700 px-4 py-2 rounded text-sm hover:bg-slate-600 transition">Test: Unregistered</button>
      </div>
    </div>
  );
}
