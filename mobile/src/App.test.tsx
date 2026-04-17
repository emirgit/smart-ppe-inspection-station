import { render, screen, fireEvent, act } from '@testing-library/react';
import App from './App';
import '@testing-library/jest-dom';

describe('Turnstile Display App UI', () => {
  it('renders idle screen initially', () => {
    render(<App />);
    expect(screen.getByText(/Please Scan Your valid RFID ID Card/i)).toBeInTheDocument();
  });

  it('runs PASS_FLOW correctly', () => {
    jest.useFakeTimers();
    render(<App />);

    const testPassBtn = screen.getByText('Test: Pass');
    fireEvent.click(testPassBtn);

    // IDENTIFYING
    expect(screen.getByText(/Verifying Identity\.\.\./i)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1600);
    });
    // INSPECTING
    expect(screen.getByText(/Inspecting PPE\.\.\./i)).toBeInTheDocument();
    
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    // PASS
    expect(screen.getByText(/ACCESS GRANTED/i)).toBeInTheDocument();
    expect(screen.getByText(/Welcome, Ahmed K./i)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    // Back to IDLE
    expect(screen.getByText(/Please Scan Your valid RFID ID Card/i)).toBeInTheDocument();

    jest.useRealTimers();
  });
});
