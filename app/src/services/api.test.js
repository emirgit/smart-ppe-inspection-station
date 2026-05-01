/**
 * @file    api.test.js
 * @brief   Unit tests for the Admin Panel API service (MOD-05 v2.0)
 * @author  Tarık Saeede (200104004804)
 *
 * Tests run against the mock API. Same tests will work against the real
 * backend once VITE_USE_MOCK is set to false in settings.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { api, ApiError } from './api';
import { updateSettings } from '@/lib/settings';

beforeEach(() => {
  updateSettings({ useMock: true });
});

describe('API — Workers', () => {
  it('lists workers', async () => {
    const res = await api.listWorkers();
    expect(res.success).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.total).toBeGreaterThan(0);
  });

  it('each worker has the contract fields', async () => {
    const res = await api.listWorkers();
    const w = res.data[0];
    expect(w).toHaveProperty('id');
    expect(w).toHaveProperty('full_name');
    expect(w).toHaveProperty('rfid_card_uid');
    expect(w).toHaveProperty('role_id');
    expect(w).toHaveProperty('role_name');
    expect(w).toHaveProperty('is_active');
  });

  it('filters workers by is_active', async () => {
    const active = await api.listWorkers({ is_active: true });
    const inactive = await api.listWorkers({ is_active: false });
    active.data.forEach(w => expect(w.is_active).toBe(true));
    inactive.data.forEach(w => expect(w.is_active).toBe(false));
  });

  it('gets a worker by ID', async () => {
    const res = await api.getWorkerById(1);
    expect(res.data.id).toBe(1);
  });

  it('throws 404 for non-existent worker', async () => {
    await expect(api.getWorkerById(99999)).rejects.toThrow(ApiError);
  });

  it('creates a new worker', async () => {
    const res = await api.createWorker({
      full_name: 'Test Worker',
      rfid_card_uid: 'TEST0001',
      role_id: 1,
    });
    expect(res.success).toBe(true);
    expect(res.data.full_name).toBe('Test Worker');
    expect(res.data.is_active).toBe(true);
  });

  it('rejects duplicate RFID UID', async () => {
    await api.createWorker({ full_name: 'A', rfid_card_uid: 'DUP0001', role_id: 1 });
    await expect(
      api.createWorker({ full_name: 'B', rfid_card_uid: 'DUP0001', role_id: 1 })
    ).rejects.toThrow();
  });

  it('soft-deletes a worker', async () => {
    const created = await api.createWorker({ full_name: 'Del', rfid_card_uid: 'DEL0001', role_id: 1 });
    await api.softDeleteWorker(created.data.id);
    const res = await api.getWorkerById(created.data.id);
    expect(res.data.is_active).toBe(false);
  });

  it('looks up worker by RFID card with required PPE', async () => {
    const res = await api.lookupWorkerByCard('A1B2C3D4');
    expect(res.data.worker.full_name).toBe('Ahmet Yılmaz');
    expect(Array.isArray(res.data.required_ppe)).toBe(true);
    res.data.required_ppe.forEach(item => {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('item_key');
      expect(item).toHaveProperty('display_name');
    });
  });
});

describe('API — Roles', () => {
  it('lists roles with PPE items and worker count', async () => {
    const res = await api.listRoles();
    expect(res.success).toBe(true);
    res.data.forEach(r => {
      expect(r).toHaveProperty('role_name');
      expect(r).toHaveProperty('ppe_items');
      expect(r).toHaveProperty('worker_count');
    });
  });

  it('creates a new role', async () => {
    const res = await api.createRole({ role_name: 'Test Role X', description: 'desc' });
    expect(res.data.role_name).toBe('Test Role X');
  });

  it('replaces PPE requirements', async () => {
    const res = await api.replaceRolePpe(1, { ppe_item_ids: [1, 2] });
    expect(res.data.ppe_items.length).toBe(2);
  });

  it('cannot delete role with active workers', async () => {
    await expect(api.deleteRole(1)).rejects.toThrow(/active worker/i);
  });
});

describe('API — PPE Items', () => {
  it('lists all PPE items', async () => {
    const res = await api.listPpeItems();
    expect(res.data.length).toBeGreaterThanOrEqual(5);
  });

  it('each PPE item has required fields', async () => {
    const res = await api.listPpeItems();
    res.data.forEach(p => {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('item_key');
      expect(p).toHaveProperty('display_name');
    });
  });

  it('includes core PPE keys', async () => {
    const res = await api.listPpeItems();
    const keys = res.data.map(p => p.item_key);
    expect(keys).toContain('hard_hat');
    expect(keys).toContain('safety_vest');
    expect(keys).toContain('gloves');
  });
});

describe('API — Entry Logs', () => {
  it('lists logs sorted newest first', async () => {
    const res = await api.listEntryLogs();
    for (let i = 1; i < res.data.length; i++) {
      const prev = new Date(res.data[i - 1].scanned_at);
      const curr = new Date(res.data[i].scanned_at);
      expect(prev.getTime()).toBeGreaterThanOrEqual(curr.getTime());
    }
  });

  it('filters logs by result', async () => {
    const res = await api.listEntryLogs({ result: 'FAIL' });
    res.data.forEach(l => expect(l.result).toBe('FAIL'));
  });

  it('paginates with limit and offset', async () => {
    const page1 = await api.listEntryLogs({ limit: 5, offset: 0 });
    const page2 = await api.listEntryLogs({ limit: 5, offset: 5 });
    expect(page1.data.length).toBeLessThanOrEqual(5);
    expect(page1.data[0].id).not.toBe(page2.data[0]?.id);
  });

  it('FAIL logs include missing_ppe', async () => {
    const res = await api.listEntryLogs({ result: 'FAIL' });
    res.data.forEach(l => {
      expect(Array.isArray(l.missing_ppe)).toBe(true);
      expect(l.missing_ppe.length).toBeGreaterThan(0);
    });
  });
});

describe('API — Stats', () => {
  it('returns all required stat fields', async () => {
    const res = await api.getEntryLogStats();
    const s = res.data;
    expect(s).toHaveProperty('total_scans');
    expect(s).toHaveProperty('passed');
    expect(s).toHaveProperty('failed');
    expect(s).toHaveProperty('compliance_rate');
    expect(s).toHaveProperty('most_missed_ppe');
    expect(s).toHaveProperty('daily_data');
    expect(s).toHaveProperty('period');
  });

  it('compliance rate is between 0 and 100', async () => {
    const res = await api.getEntryLogStats();
    expect(res.data.compliance_rate).toBeGreaterThanOrEqual(0);
    expect(res.data.compliance_rate).toBeLessThanOrEqual(100);
  });

  it('most_missed_ppe is sorted descending', async () => {
    const res = await api.getEntryLogStats();
    for (let i = 1; i < res.data.most_missed_ppe.length; i++) {
      expect(res.data.most_missed_ppe[i - 1].miss_count)
        .toBeGreaterThanOrEqual(res.data.most_missed_ppe[i].miss_count);
    }
  });

  it('filters stats by date range', async () => {
    const res = await api.getEntryLogStats({ start_date: '2026-04-29', end_date: '2026-04-29' });
    expect(res.data.period.start_date).toBe('2026-04-29');
  });
});
