/**
 * @file    pages.test.jsx
 * @brief   Component rendering tests for Admin Panel pages
 * @author  Tarık Saeede (200104004804)
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import Workers from './Workers';

function renderWithRouter(component) {
  return render(<BrowserRouter>{component}</BrowserRouter>);
}

describe('Dashboard Page', () => {
  it('should render the dashboard title', async () => {
    renderWithRouter(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('should display stat cards after loading', async () => {
    renderWithRouter(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('Active Workers')).toBeInTheDocument();
      expect(screen.getByText("Today's Scans")).toBeInTheDocument();
      expect(screen.getByText('Compliance Rate')).toBeInTheDocument();
    });
  });

  it('should display recent activity section', async () => {
    renderWithRouter(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });
  });

  it('should display most missed PPE section', async () => {
    renderWithRouter(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('Most Missed PPE Items')).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    renderWithRouter(<Dashboard />);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('Workers Page', () => {
  it('should render the workers title', async () => {
    renderWithRouter(<Workers />);
    await waitFor(() => {
      expect(screen.getByText('Workers')).toBeInTheDocument();
    });
  });

  it('should show Register Worker button', async () => {
    renderWithRouter(<Workers />);
    await waitFor(() => {
      expect(screen.getByText('Register Worker')).toBeInTheDocument();
    });
  });

  it('should display worker table with names after loading', async () => {
    renderWithRouter(<Workers />);
    await waitFor(() => {
      expect(screen.getByText('Ahmet Yılmaz')).toBeInTheDocument();
    });
  });

  it('should have role filter dropdown', async () => {
    renderWithRouter(<Workers />);
    await waitFor(() => {
      expect(screen.getByText('All Roles')).toBeInTheDocument();
    });
  });

  it('should have status filter dropdown', async () => {
    renderWithRouter(<Workers />);
    await waitFor(() => {
      expect(screen.getByText('All Status')).toBeInTheDocument();
    });
  });

  it('should open registration modal on button click', async () => {
    renderWithRouter(<Workers />);
    await waitFor(() => {
      expect(screen.getByText('Register Worker')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register Worker'));

    await waitFor(() => {
      expect(screen.getByText('Register New Worker')).toBeInTheDocument();
      expect(screen.getByText('Full Name')).toBeInTheDocument();
      expect(screen.getByText('RFID Card UID')).toBeInTheDocument();
      expect(screen.getByText('Job Role')).toBeInTheDocument();
    });
  });

  it('should show search input for filtering', async () => {
    renderWithRouter(<Workers />);
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/search/i);
      expect(searchInput).toBeInTheDocument();
    });
  });
});
