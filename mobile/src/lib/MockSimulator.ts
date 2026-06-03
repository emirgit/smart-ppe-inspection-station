/**
 * @file    MockSimulator.ts
 * @brief   Mock event source used in development when MOD-03 is offline.
 *
 * Drives the IDLE → IDENTIFYING → INSPECTING → PASS/FAIL → IDLE flow
 * with realistic delays so the UI can be exercised end-to-end on any
 * developer machine. The mock data mirrors the canonical examples in
 * doc/knowledge.md so that tests and screenshots stay consistent.
 */
import {
  DisplayState,
  DISPLAY_FAIL_TIMEOUT_MS,
  DISPLAY_PASS_TIMEOUT_MS,
  DISPLAY_UNKNOWN_CARD_TIMEOUT_MS,
  type IMockEventSimulator,
  MockScenario,
  type OnDisplayMessageCallback,
  type RequiredPpeItem,
} from '../interfaces/display_interface';

const IDENTIFYING_DELAY_MS = 1000;
const INSPECTING_DELAY_MS = 2000;

const MOCK_WORKER_PASS = {
  id: 1,
  full_name: 'Ahmet Yılmaz',
  photo_url: null,
  role_name: 'Technician',
} as const;

const MOCK_WORKER_FAIL = {
  id: 3,
  full_name: 'Mehmet Kaya',
  photo_url: null,
  role_name: 'Construction Worker',
} as const;

const MOCK_REQUIRED_PPE: RequiredPpeItem[] = [
  { id: 1, item_key: 'hard_hat', display_name: 'Hard Hat', icon_name: 'hard_hat' },
  { id: 2, item_key: 'safety_vest', display_name: 'Safety Vest', icon_name: 'safety_vest' },
  { id: 3, item_key: 'gloves', display_name: 'Gloves', icon_name: 'gloves' },
];

const MOCK_DETECTED_PARTIAL: RequiredPpeItem[] = [MOCK_REQUIRED_PPE[0]];

const MOCK_MISSING_PPE: RequiredPpeItem[] = [
  MOCK_REQUIRED_PPE[1],
  MOCK_REQUIRED_PPE[2],
];

export class MockSimulator implements IMockEventSimulator {
  private timeoutIds: number[] = [];

  runScenario(
    scenario: MockScenario,
    callback: OnDisplayMessageCallback
  ): void {
    this.stopScenario();

    callback({
      state: DisplayState.IDENTIFYING,
      rfid_card_uid: 'A3F2C1D4',
    });

    if (scenario === MockScenario.UNKNOWN_CARD_FLOW) {
      this.schedule(() => {
        callback({
          state: DisplayState.UNKNOWN_CARD,
          rfid_card_uid: 'A3F2C1D4',
        });
      }, IDENTIFYING_DELAY_MS);
      this.schedule(() => {
        callback({ state: DisplayState.IDLE });
      }, IDENTIFYING_DELAY_MS + DISPLAY_UNKNOWN_CARD_TIMEOUT_MS);
      return;
    }

    const isPass = scenario === MockScenario.PASS_FLOW;
    const worker = isPass ? MOCK_WORKER_PASS : MOCK_WORKER_FAIL;

    this.schedule(() => {
      callback({
        state: DisplayState.INSPECTING,
        worker,
        required_ppe: MOCK_REQUIRED_PPE,
        instruction: 'Please face the camera and raise your hands',
      });
    }, IDENTIFYING_DELAY_MS);

    const terminalAt = IDENTIFYING_DELAY_MS + INSPECTING_DELAY_MS;
    this.schedule(() => {
      if (isPass) {
        callback({
          state: DisplayState.PASS,
          worker,
          detected_ppe: MOCK_REQUIRED_PPE,
        });
      } else {
        callback({
          state: DisplayState.FAIL,
          worker,
          detected_ppe: MOCK_DETECTED_PARTIAL,
          missing_ppe: MOCK_MISSING_PPE,
        });
      }
    }, terminalAt);

    const idleAt =
      terminalAt + (isPass ? DISPLAY_PASS_TIMEOUT_MS : DISPLAY_FAIL_TIMEOUT_MS);
    this.schedule(() => {
      callback({ state: DisplayState.IDLE });
    }, idleAt);
  }

  stopScenario(): void {
    for (const id of this.timeoutIds) {
      clearTimeout(id);
    }
    this.timeoutIds = [];
  }

  private schedule(fn: () => void, delay: number): void {
    const id = window.setTimeout(fn, delay);
    this.timeoutIds.push(id);
  }
}
