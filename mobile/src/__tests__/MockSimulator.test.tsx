/**
 * @file    MockSimulator.test.tsx
 * @brief   End-to-end App test exercising the MockSimulator scenarios
 *          via the dev-mode controls. Confirms the App correctly wires
 *          the simulator into the controller and the screens.
 */
import { fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState({}, '', '/?mock=1');
});

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState({}, '', '/');
});

describe('Mock scenarios driven by the App', () => {
  it('renders the mock controls only when mock mode is active', () => {
    render(<App />);
    expect(screen.getByTestId('mock-controls')).toBeInTheDocument();
    expect(screen.getByTestId('screen-idle')).toBeInTheDocument();
  });

  it('runs the GRANTED flow end to end and returns to IDLE', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /granted/i }));

    expect(screen.getByTestId('screen-identifying')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.getByTestId('screen-inspecting')).toBeInTheDocument();
    expect(screen.getByText(/Ahmet Yılmaz/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId('screen-granted')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId('screen-idle')).toBeInTheDocument();
  });

  it('runs the DENIED flow and surfaces the missing PPE', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /denied/i }));
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.getByTestId('screen-denied')).toBeInTheDocument();
    expect(screen.getByText(/Mehmet Kaya/i)).toBeInTheDocument();
    expect(screen.getByTestId('missing-ppe-list')).toHaveTextContent(
      'Safety Vest'
    );
    expect(screen.getByTestId('missing-ppe-list')).toHaveTextContent('Gloves');
  });

  it('runs the unknown card flow', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /unknown/i }));
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.getByTestId('screen-unknown-card')).toBeInTheDocument();
  });
});
