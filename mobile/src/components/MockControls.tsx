import { MockScenario } from '../interfaces/display_interface';

const SCENARIO_LABELS: Record<MockScenario, string> = {
  [MockScenario.PASS_FLOW]: 'Granted',
  [MockScenario.FAIL_FLOW]: 'Denied',
  [MockScenario.UNKNOWN_CARD_FLOW]: 'Unknown card',
};

export interface MockControlsProps {
  onRun: (scenario: MockScenario) => void;
  onReset: () => void;
}

export function MockControls({ onRun, onReset }: MockControlsProps) {
  return (
    <div
      data-testid="mock-controls"
      className="absolute bottom-4 left-4 flex gap-2 bg-black/40 backdrop-blur px-3 py-2 rounded-2xl border border-white/10 text-sm"
    >
      <span className="self-center uppercase tracking-widest text-slate-300 mr-2">
        Mock
      </span>
      {(Object.values(MockScenario) as MockScenario[]).map((scenario) => (
        <button
          key={scenario}
          type="button"
          onClick={() => onRun(scenario)}
          className="bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition px-3 py-2 rounded-lg text-white"
        >
          {SCENARIO_LABELS[scenario]}
        </button>
      ))}
      <button
        type="button"
        onClick={onReset}
        className="bg-slate-800 hover:bg-slate-700 transition px-3 py-2 rounded-lg text-slate-200 border border-white/10"
      >
        Reset
      </button>
    </div>
  );
}
