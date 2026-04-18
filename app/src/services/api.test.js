/**
 * @file    api.test.js
 * @brief   Unit tests for the Admin Panel API service (MOD-05)
 * @author  Tarık Saeede (200104004804)
 */

import { describe, it, expect } from 'vitest';
import { api } from './api';

describe('API Service — Workers', () => {
  it('should return an array of workers', async () => {
    const workers = await api.getWorkers();
    expect(Array.isArray(workers)).toBe(true);
    expect(workers.length).toBeGreaterThan(0);
  });

  it('each worker should have required fields', async () => {
    const workers = await api.getWorkers();
    const worker = workers[0];
    expect(worker).toHaveProperty('id');
    expect(worker).toHaveProperty('fullName');
    expect(worker).toHaveProperty('rfidCardUid');
    expect(worker).toHaveProperty('roleId');
    expect(worker).toHaveProperty('roleName');
    expect(worker).toHaveProperty('isActive');
    expect(worker).toHaveProperty('createdAt');
  });

  it('should return a specific worker by ID', async () => {
    const worker = await api.getWorker(1);
    expect(worker).not.toBeNull();
    expect(worker.id).toBe(1);
    expect(typeof worker.fullName).toBe('string');
  });

  it('should return null for non-existent worker ID', async () => {
    const worker = await api.getWorker(9999);
    expect(worker).toBeNull();
  });

  it('should create a new worker with valid data', async () => {
    const newWorker = await api.createWorker({
      fullName: 'Test Worker',
      rfidCardUid: 'TEST1234',
      roleId: 1,
    });
    expect(newWorker).toHaveProperty('id');
    expect(newWorker.fullName).toBe('Test Worker');
    expect(newWorker.rfidCardUid).toBe('TEST1234');
    expect(newWorker.roleId).toBe(1);
    expect(newWorker.isActive).toBe(true);
  });

  it('should soft-delete a worker (set isActive to false)', async () => {
    const result = await api.deleteWorker(1);
    expect(result.success).toBe(true);
    const workers = await api.getWorkers();
    const deleted = workers.find(w => w.id === 1);
    expect(deleted.isActive).toBe(false);
  });
});

describe('API Service — Roles', () => {
  it('should return an array of roles', async () => {
    const roles = await api.getRoles();
    expect(Array.isArray(roles)).toBe(true);
    expect(roles.length).toBeGreaterThan(0);
  });

  it('each role should have id, roleName, and requiredPpe', async () => {
    const roles = await api.getRoles();
    const role = roles[0];
    expect(role).toHaveProperty('id');
    expect(role).toHaveProperty('roleName');
    expect(role).toHaveProperty('requiredPpe');
    expect(Array.isArray(role.requiredPpe)).toBe(true);
  });

  it('different roles should require different PPE sets', async () => {
    const roles = await api.getRoles();
    const constructionWorker = roles.find(r => r.roleName === 'Construction Worker');
    const visitor = roles.find(r => r.roleName === 'Visitor');
    expect(constructionWorker.requiredPpe.length).toBeGreaterThan(visitor.requiredPpe.length);
  });
});

describe('API Service — PPE Items', () => {
  it('should return all PPE item types', async () => {
    const items = await api.getPpeItems();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(5);
  });

  it('each PPE item should have itemKey and displayName', async () => {
    const items = await api.getPpeItems();
    items.forEach(item => {
      expect(item).toHaveProperty('itemKey');
      expect(item).toHaveProperty('displayName');
      expect(typeof item.itemKey).toBe('string');
      expect(typeof item.displayName).toBe('string');
    });
  });

  it('should include core PPE items (hard_hat, safety_vest, gloves)', async () => {
    const items = await api.getPpeItems();
    const keys = items.map(i => i.itemKey);
    expect(keys).toContain('hard_hat');
    expect(keys).toContain('safety_vest');
    expect(keys).toContain('gloves');
  });
});

describe('API Service — Entry Logs', () => {
  it('should return entry logs sorted by date (newest first)', async () => {
    const logs = await api.getEntryLogs();
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThan(0);
    for (let i = 1; i < logs.length; i++) {
      const prev = new Date(logs[i - 1].scannedAt);
      const curr = new Date(logs[i].scannedAt);
      expect(prev.getTime()).toBeGreaterThanOrEqual(curr.getTime());
    }
  });

  it('should filter logs by result', async () => {
    const failLogs = await api.getEntryLogs({ result: 'FAIL' });
    failLogs.forEach(log => {
      expect(log.result).toBe('FAIL');
    });
    const passLogs = await api.getEntryLogs({ result: 'PASS' });
    passLogs.forEach(log => {
      expect(log.result).toBe('PASS');
    });
  });

  it('should filter logs by search term', async () => {
    const logs = await api.getEntryLogs({ search: 'Ahmet' });
    logs.forEach(log => {
      expect(log.workerName?.toLowerCase()).toContain('ahmet');
    });
  });

  it('entry log should contain required fields', async () => {
    const logs = await api.getEntryLogs();
    const log = logs[0];
    expect(log).toHaveProperty('id');
    expect(log).toHaveProperty('rfidUid');
    expect(log).toHaveProperty('result');
    expect(log).toHaveProperty('scannedAt');
    expect(['PASS', 'FAIL', 'UNKNOWN_CARD']).toContain(log.result);
  });

  it('FAIL logs should have missingItems array', async () => {
    const logs = await api.getEntryLogs({ result: 'FAIL' });
    logs.forEach(log => {
      expect(Array.isArray(log.missingItems)).toBe(true);
      expect(log.missingItems.length).toBeGreaterThan(0);
    });
  });
});

describe('API Service — Dashboard Stats', () => {
  it('should return statistics with all required fields', async () => {
    const stats = await api.getStats();
    expect(stats).toHaveProperty('totalWorkers');
    expect(stats).toHaveProperty('todayScans');
    expect(stats).toHaveProperty('complianceRate');
    expect(stats).toHaveProperty('totalScans');
    expect(stats).toHaveProperty('passed');
    expect(stats).toHaveProperty('failed');
    expect(stats).toHaveProperty('mostMissed');
    expect(stats).toHaveProperty('dailyData');
    expect(stats).toHaveProperty('recentLogs');
  });

  it('compliance rate should be between 0 and 100', async () => {
    const stats = await api.getStats();
    expect(stats.complianceRate).toBeGreaterThanOrEqual(0);
    expect(stats.complianceRate).toBeLessThanOrEqual(100);
  });

  it('passed + failed should be <= totalScans', async () => {
    const stats = await api.getStats();
    expect(stats.passed + stats.failed).toBeLessThanOrEqual(stats.totalScans);
  });

  it('mostMissed should be sorted by count descending', async () => {
    const stats = await api.getStats();
    for (let i = 1; i < stats.mostMissed.length; i++) {
      expect(stats.mostMissed[i - 1].count).toBeGreaterThanOrEqual(stats.mostMissed[i].count);
    }
  });

  it('dailyData should contain date, pass, fail, rate fields', async () => {
    const stats = await api.getStats();
    expect(stats.dailyData.length).toBeGreaterThan(0);
    stats.dailyData.forEach(day => {
      expect(day).toHaveProperty('date');
      expect(day).toHaveProperty('pass');
      expect(day).toHaveProperty('fail');
      expect(day).toHaveProperty('rate');
    });
  });

  it('recentLogs should contain at most 5 entries', async () => {
    const stats = await api.getStats();
    expect(stats.recentLogs.length).toBeLessThanOrEqual(5);
  });
});
