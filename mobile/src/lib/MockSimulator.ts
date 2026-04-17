import {
  IMockEventSimulator,
  MockScenario,
  OnDisplayMessageCallback,
  DisplayState,
  RequiredPpeItem,
} from "../interfaces/display_interface";

const mockPpeItems: RequiredPpeItem[] = [
  { id: 1, item_key: "hard_hat", display_name: "Hard Hat", icon_name: "hard-hat" },
  { id: 2, item_key: "safety_vest", display_name: "Safety Vest", icon_name: "vest" },
];

const mockWorker = {
  id: 1,
  full_name: "Ahmed K.",
  photo_url: null,
  role_name: "Engineer",
};

export class MockSimulator implements IMockEventSimulator {
  private timeoutIds: number[] = [];

  runScenario(scenario: MockScenario, callback: OnDisplayMessageCallback): void {
    this.stopScenario();

    // 1. IDENTIFYING
    callback({ state: DisplayState.IDENTIFYING, rfid_card_uid: "A1B2" });

    let t1, t2;

    if (scenario === MockScenario.UNKNOWN_CARD_FLOW) {
      t1 = window.setTimeout(() => {
        callback({ state: DisplayState.UNKNOWN_CARD, rfid_card_uid: "A1B2" });
      }, 1500);
      
      t2 = window.setTimeout(() => {
        callback({ state: DisplayState.IDLE });
      }, 5000);
      this.timeoutIds.push(t1, t2);
      return;
    }

    t1 = window.setTimeout(() => {
      callback({
        state: DisplayState.INSPECTING,
        worker: mockWorker,
        required_ppe: mockPpeItems,
        instruction: "Please look at the camera",
      });
    }, 1500);

    t2 = window.setTimeout(() => {
      if (scenario === MockScenario.PASS_FLOW) {
        callback({
          state: DisplayState.PASS,
          worker: mockWorker,
          detected_ppe: mockPpeItems,
        });
      } else {
        callback({
          state: DisplayState.FAIL,
          worker: mockWorker,
          detected_ppe: [mockPpeItems[0]],
          missing_ppe: [mockPpeItems[1]],
        });
      }
    }, 4500);

    const t3 = window.setTimeout(() => {
      callback({ state: DisplayState.IDLE });
    }, 9500);

    this.timeoutIds.push(t1, t2, t3);
  }

  stopScenario(): void {
    this.timeoutIds.forEach(clearTimeout);
    this.timeoutIds = [];
  }
}
