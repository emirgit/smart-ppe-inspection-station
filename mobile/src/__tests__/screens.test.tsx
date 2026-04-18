/**
 * @file    screens.test.tsx
 * @brief   Screen rendering tests SR-01 through SR-06
 *          (see doc/knowledge.md → Unit Tests Required).
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ConnectionErrorScreen,
  DeniedScreen,
  GrantedScreen,
  IdentifyingScreen,
  IdleScreen,
  InspectingScreen,
  UnknownCardScreen,
} from '../screens/Screens';
import { DisplayState } from '../interfaces/display_interface';

const worker = {
  id: 1,
  full_name: 'Ahmet Yılmaz',
  photo_url: null,
  role_name: 'Technician',
} as const;

const ppe = [
  { id: 1, item_key: 'hard_hat', display_name: 'Hard Hat', icon_name: 'hard_hat' },
  { id: 2, item_key: 'safety_vest', display_name: 'Safety Vest', icon_name: 'safety_vest' },
];

describe('Screen rendering', () => {
  it('SR-01: IdleScreen shows the scan-card prompt', () => {
    render(<IdleScreen />);
    expect(screen.getByText(/scan your card/i)).toBeInTheDocument();
  });

  it('SR-02: IdentifyingScreen shows a loading indicator', () => {
    render(<IdentifyingScreen />);
    expect(screen.getByText(/identifying/i)).toBeInTheDocument();
    expect(screen.getByTestId('screen-identifying')).toBeInTheDocument();
  });

  it('SR-03: UnknownCardScreen shows the unregistered-card warning', () => {
    render(
      <UnknownCardScreen
        message={{
          state: DisplayState.UNKNOWN_CARD,
          rfid_card_uid: 'A3F2C1D4',
        }}
      />
    );
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    expect(screen.getByText(/unregistered card/i)).toBeInTheDocument();
    expect(screen.getByText(/A3F2C1D4/i)).toBeInTheDocument();
  });

  it('SR-04: InspectingScreen shows worker info and required PPE', () => {
    render(
      <InspectingScreen
        message={{
          state: DisplayState.INSPECTING,
          worker,
          required_ppe: ppe,
          instruction: 'Please face the camera',
        }}
      />
    );
    expect(screen.getByText(worker.full_name)).toBeInTheDocument();
    expect(screen.getByText(/please face the camera/i)).toBeInTheDocument();
    expect(screen.getByText('Hard Hat')).toBeInTheDocument();
    expect(screen.getByText('Safety Vest')).toBeInTheDocument();
  });

  it('SR-05: GrantedScreen shows welcome message and detected PPE', () => {
    render(
      <GrantedScreen
        message={{
          state: DisplayState.PASS,
          worker,
          detected_ppe: ppe,
        }}
      />
    );
    expect(screen.getByText(/access granted/i)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`welcome,\\s*${worker.full_name}`, 'i'))
    ).toBeInTheDocument();
    expect(screen.getByText('Hard Hat')).toBeInTheDocument();
  });

  it('SR-06: DeniedScreen lists missing PPE and shows access-denied banner', () => {
    render(
      <DeniedScreen
        message={{
          state: DisplayState.FAIL,
          worker,
          detected_ppe: [ppe[0]],
          missing_ppe: [ppe[1]],
        }}
      />
    );
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    const missingList = screen.getByTestId('missing-ppe-list');
    expect(missingList).toHaveTextContent('Safety Vest');
    expect(missingList).toHaveTextContent(/missing/i);
    const detectedList = screen.getByTestId('detected-ppe-list');
    expect(detectedList).toHaveTextContent('Hard Hat');
  });

  it('Connection error screen is rendered when the link is down', () => {
    render(<ConnectionErrorScreen />);
    expect(screen.getByText(/connection lost/i)).toBeInTheDocument();
  });
});
