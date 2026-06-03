import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ScanLine,
  ShieldAlert,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { PpeList } from '../components/PpeList';
import { WorkerCard } from '../components/WorkerCard';
import type {
  DisplayMessageFail,
  DisplayMessageInspecting,
  DisplayMessagePass,
  DisplayMessageUnknownCard,
} from '../interfaces/display_interface';

const SCREEN_BASE =
  'w-full h-full flex flex-col items-center justify-center text-center px-10 animate-fade-in';

export function IdleScreen() {
  return (
    <section
      data-testid="screen-idle"
      className={`${SCREEN_BASE} bg-gradient-to-b from-slate-900 to-slate-950`}
    >
      <ScanLine
        className="text-blue-400 animate-pulse-soft mb-10"
        size={180}
      />
      <h1 className="text-7xl font-extrabold tracking-tight mb-4">
        Scan your card
      </h1>
      <p className="text-2xl text-slate-300 max-w-3xl">
        Hold your RFID badge in front of the reader to begin inspection.
      </p>
    </section>
  );
}

export function IdentifyingScreen() {
  return (
    <section
      data-testid="screen-identifying"
      className={`${SCREEN_BASE} bg-gradient-to-b from-slate-900 to-slate-950`}
    >
      <Loader2 className="text-blue-400 animate-spin mb-10" size={160} />
      <h1 className="text-6xl font-extrabold tracking-tight mb-4">
        Identifying...
      </h1>
      <p className="text-2xl text-slate-300">Looking up your record.</p>
    </section>
  );
}

export interface UnknownCardScreenProps {
  message: DisplayMessageUnknownCard | null;
}

export function UnknownCardScreen({ message }: UnknownCardScreenProps) {
  return (
    <section
      data-testid="screen-unknown-card"
      className={`${SCREEN_BASE} bg-gradient-to-b from-rose-900 to-rose-950`}
    >
      <ShieldAlert className="text-rose-200 mb-10" size={180} />
      <h1 className="text-7xl font-extrabold tracking-tight mb-4">
        Access Denied
      </h1>
      <p className="text-3xl text-rose-100 mb-6">Unregistered Card</p>
      {message?.rfid_card_uid ? (
        <p className="text-lg uppercase tracking-widest text-rose-200/80">
          Card UID: {message.rfid_card_uid}
        </p>
      ) : null}
      <p className="text-xl text-rose-100/80 mt-10 max-w-2xl">
        This badge is not registered. Please contact a supervisor.
      </p>
    </section>
  );
}

export interface InspectingScreenProps {
  message: DisplayMessageInspecting;
}

export function InspectingScreen({ message }: InspectingScreenProps) {
  return (
    <section
      data-testid="screen-inspecting"
      className={`${SCREEN_BASE} bg-gradient-to-b from-slate-900 to-slate-950 justify-start pt-16`}
    >
      <h2 className="text-4xl font-bold text-amber-300 mb-6">
        Inspection in progress
      </h2>
      <WorkerCard worker={message.worker} />
      <p className="mt-8 text-3xl text-slate-100 max-w-3xl bg-white/5 px-8 py-4 rounded-2xl border border-white/10">
        {message.instruction ??
          'Please face the camera and raise your hands.'}
      </p>
      <div className="mt-10 w-full max-w-5xl">
        <h3 className="text-xl uppercase tracking-widest text-slate-400 mb-3 text-left">
          Required PPE
        </h3>
        <PpeList items={message.required_ppe} variant="required" />
      </div>
    </section>
  );
}

export interface GrantedScreenProps {
  message: DisplayMessagePass;
}

export function GrantedScreen({ message }: GrantedScreenProps) {
  return (
    <section
      data-testid="screen-granted"
      className={`${SCREEN_BASE} bg-gradient-to-b from-emerald-700 to-emerald-900 justify-start pt-16`}
    >
      <CheckCircle2 className="text-white mb-6" size={140} />
      <h1 className="text-7xl font-extrabold tracking-tight mb-4 text-white">
        Access Granted
      </h1>
      <p className="text-3xl text-emerald-50 mb-8">
        Welcome, {message.worker.full_name}. You may enter.
      </p>
      <div className="w-full max-w-5xl">
        <h3 className="text-xl uppercase tracking-widest text-emerald-100/90 mb-3 text-left">
          Detected equipment
        </h3>
        <PpeList items={message.detected_ppe} variant="detected" />
      </div>
    </section>
  );
}

export interface DeniedScreenProps {
  message: DisplayMessageFail;
}

export function DeniedScreen({ message }: DeniedScreenProps) {
  return (
    <section
      data-testid="screen-denied"
      className={`${SCREEN_BASE} bg-gradient-to-b from-rose-700 to-rose-950 justify-start pt-12`}
    >
      <XCircle className="text-white mb-4" size={120} />
      <h1 className="text-7xl font-extrabold tracking-tight mb-2 text-white">
        Access Denied
      </h1>
      <p className="text-2xl text-rose-50 mb-6">
        Missing equipment for {message.worker.full_name}.
      </p>
      <div className="w-full max-w-5xl mb-6">
        <h3 className="text-xl uppercase tracking-widest text-rose-100 mb-3 text-left">
          Missing PPE
        </h3>
        <PpeList
          items={message.missing_ppe}
          variant="missing"
          testId="missing-ppe-list"
        />
      </div>
      {message.detected_ppe.length > 0 ? (
        <div className="w-full max-w-5xl">
          <h3 className="text-xl uppercase tracking-widest text-rose-100/80 mb-3 text-left">
            Detected so far
          </h3>
          <PpeList
            items={message.detected_ppe}
            variant="detected"
            testId="detected-ppe-list"
          />
        </div>
      ) : null}
    </section>
  );
}

export function ConnectionErrorScreen() {
  return (
    <section
      data-testid="screen-connection-error"
      className={`${SCREEN_BASE} bg-gradient-to-b from-amber-900 to-slate-950`}
    >
      <WifiOff className="text-amber-300 mb-8" size={160} />
      <h1 className="text-6xl font-extrabold tracking-tight mb-4">
        Connection Lost
      </h1>
      <p className="text-2xl text-amber-100/90 mb-2">
        The display cannot reach the inspection controller.
      </p>
      <p className="text-xl text-amber-100/80 max-w-2xl flex items-center gap-3 justify-center">
        <AlertTriangle size={28} /> Please contact staff.
      </p>
    </section>
  );
}
