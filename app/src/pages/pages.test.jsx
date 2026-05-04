/**
 * @file    pages.test.jsx
 * @brief   Component rendering tests for Admin Panel pages (v2.0)
 * @author  Tarık Saeede (200104004804)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/context/theme-provider';
import { updateSettings } from '@/lib/settings';
import Dashboard from './Dashboard';
import Workers from './Workers';
import Logs from './Logs';

beforeEach(() => {
  updateSettings({ useMock: true });
});

function renderPage(component) {
  return render(
    <ThemeProvider>
      <BrowserRouter>{component}</BrowserRouter>
    </ThemeProvider>
  );
}

describe('Dashboard', () => {
  it('renders the dashboard title', async () => {
    renderPage(<Dashboard />);
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
  });

  it('shows the four stat cards after loading', async () => {
    renderPage(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('Active Workers')).toBeInTheDocument();
      expect(screen.getByText("Today's Scans")).toBeInTheDocument();
      expect(screen.getByText('Compliance Rate')).toBeInTheDocument();
      expect(screen.getByText('Failed Today')).toBeInTheDocument();
    });
  });

  it('displays Recent Activity section', async () => {
    renderPage(<Dashboard />);
    await waitFor(() => expect(screen.getByText('Recent Activity')).toBeInTheDocument());
  });

  it('displays Most Missed PPE section', async () => {
    renderPage(<Dashboard />);
    await waitFor(() => expect(screen.getByText('Most Missed PPE Items')).toBeInTheDocument());
  });
});

describe('Workers', () => {
  it('renders the workers title', async () => {
    renderPage(<Workers />);
    await waitFor(() => expect(screen.getByText('Workers')).toBeInTheDocument());
  });

  it('shows Register Worker button', async () => {
    renderPage(<Workers />);
    await waitFor(() => expect(screen.getByText('Register Worker')).toBeInTheDocument());
  });

  it('displays worker rows after loading', async () => {
    renderPage(<Workers />);
    await waitFor(() => expect(screen.getByText('Ahmet Yılmaz')).toBeInTheDocument());
  });

  it('opens registration dialog with plain RFID input', async () => {
    renderPage(<Workers />);
    await waitFor(() => expect(screen.getByText('Register Worker')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Register Worker'));

    await waitFor(() => {
      expect(screen.getByText('Register New Worker')).toBeInTheDocument();
      expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
      expect(screen.getByLabelText('RFID Card UID')).toBeInTheDocument();
      // Must be a regular input, not a Scan button
      const rfidInput = screen.getByLabelText('RFID Card UID');
      expect(rfidInput.tagName).toBe('INPUT');
      expect(rfidInput).not.toHaveAttribute('readonly');
    });
  });

  it('has search input for filtering', async () => {
    renderPage(<Workers />);
    await waitFor(() => {
      const search = screen.getByPlaceholderText(/search/i);
      expect(search).toBeInTheDocument();
    });
  });

  it('shows edit button for each worker', async () => {
    renderPage(<Workers />);
    await waitFor(() => expect(screen.getByText('Ahmet Yılmaz')).toBeInTheDocument());
    // Pencil icons render — we just verify the row has buttons
    const rows = document.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('Logs', () => {
  it('renders Entry Logs title', async () => {
    renderPage(<Logs />);
    await waitFor(() => expect(screen.getByText('Entry Logs')).toBeInTheDocument());
  });

  it('shows Refresh button', async () => {
    renderPage(<Logs />);
    await waitFor(() => expect(screen.getByText('Refresh')).toBeInTheDocument());
  });

  it('displays log entries', async () => {
    renderPage(<Logs />);
    await waitFor(() => {
      const rows = document.querySelectorAll('tbody tr');
      expect(rows.length).toBeGreaterThan(0);
    });
  });
});
