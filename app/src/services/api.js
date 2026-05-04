/**
 * @file    api.js
 * @brief   Admin Panel API service — real HTTP client with mock fallback
 * @author  Tarık Saeede (200104004804)
 *
 * Connects to MOD-04 (Express.js + PostgreSQL) backend.
 * If VITE_USE_MOCK is true OR the backend is unreachable, falls back to mock data.
 *
 * All method names match BackendApiContract from admin_side_interface.d.ts.
 * Standard response: { success: true, data: ... } or { success: false, error: { code, message } }
 */

import * as mock from './mock-data';
import { getSettings } from '@/lib/settings';

// ── Fetch wrapper ──────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const { apiBaseUrl } = getSettings();
  const url = `${apiBaseUrl}${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new ApiError(
        json.error?.code || res.status,
        json.error?.message || `HTTP ${res.status}`
      );
    }
    return json;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new ApiError(0, 'Request timeout — backend unreachable');
    }
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, err.message || 'Network error');
  }
}

export class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'ApiError';
  }
}

// ── Mock implementations (used when VITE_USE_MOCK=true) ────────

const delay = (ms = 200) => new Promise(r => setTimeout(r, ms));

let mockWorkers = [...mock.workers];
let mockRoles = [...mock.roles];
let mockPpeItems = [...mock.ppeItems];
let mockEntryLogs = [...mock.entryLogs];
let nextWorkerId = mockWorkers.length + 1;
let nextRoleId = mockRoles.length + 1;
let nextPpeId = mockPpeItems.length + 1;

const mockApi = {
  async listWorkers(query = {}) {
    await delay();
    let data = [...mockWorkers];
    if (query.is_active !== undefined) {
      data = data.filter(w => w.is_active === query.is_active);
    }
    if (query.role_id !== undefined) {
      data = data.filter(w => w.role_id === query.role_id);
    }
    return { success: true, data, total: data.length };
  },

  async createWorker(body) {
    await delay(400);
    if (mockWorkers.some(w => w.rfid_card_uid === body.rfid_card_uid)) {
      throw new ApiError(409, 'RFID card UID already registered');
    }
    const role = mockRoles.find(r => r.id === body.role_id);
    if (!role) throw new ApiError(404, 'Role not found');
    const newWorker = {
      id: nextWorkerId++,
      full_name: body.full_name,
      rfid_card_uid: body.rfid_card_uid,
      role_id: body.role_id,
      role_name: role.role_name,
      is_active: true,
      photo_url: body.photo_url || null,
      created_at: new Date().toISOString(),
      updated_at: null,
    };
    mockWorkers.push(newWorker);
    return { success: true, data: newWorker };
  },

  async getWorkerById(id) {
    await delay();
    const w = mockWorkers.find(w => w.id === id);
    if (!w) throw new ApiError(404, 'Worker not found');
    return { success: true, data: w };
  },

  async updateWorker(id, body) {
    await delay(400);
    const idx = mockWorkers.findIndex(w => w.id === id);
    if (idx === -1) throw new ApiError(404, 'Worker not found');
    if (body.rfid_card_uid && mockWorkers.some(w => w.id !== id && w.rfid_card_uid === body.rfid_card_uid)) {
      throw new ApiError(409, 'RFID card UID conflict');
    }
    const updated = { ...mockWorkers[idx], ...body, updated_at: new Date().toISOString() };
    if (body.role_id) {
      const role = mockRoles.find(r => r.id === body.role_id);
      if (role) updated.role_name = role.role_name;
    }
    mockWorkers[idx] = updated;
    return { success: true, data: updated };
  },

  async softDeleteWorker(id) {
    await delay(400);
    const idx = mockWorkers.findIndex(w => w.id === id);
    if (idx === -1) throw new ApiError(404, 'Worker not found');
    mockWorkers[idx].is_active = false;
    return { success: true, message: 'Worker deactivated', data: { id, is_active: false } };
  },

  async lookupWorkerByCard(uid) {
    await delay();
    const worker = mockWorkers.find(w => w.rfid_card_uid === uid && w.is_active);
    if (!worker) throw new ApiError(404, 'Card not registered');
    const role = mockRoles.find(r => r.id === worker.role_id);
    const required_ppe = role ? mockPpeItems.filter(p => role.required_ppe.includes(p.id)) : [];
    return { success: true, data: { worker, required_ppe } };
  },

  async listRoles() {
    await delay();
    const data = mockRoles.map(r => ({
      ...r,
      ppe_items: mockPpeItems.filter(p => r.required_ppe.includes(p.id)),
      worker_count: mockWorkers.filter(w => w.role_id === r.id && w.is_active).length,
    }));
    return { success: true, data };
  },

  async createRole(body) {
    await delay(400);
    if (mockRoles.some(r => r.role_name.toLowerCase() === body.role_name.toLowerCase())) {
      throw new ApiError(409, 'Role name already exists');
    }
    const newRole = {
      id: nextRoleId++,
      role_name: body.role_name,
      description: body.description || null,
      required_ppe: [],
      created_at: new Date().toISOString(),
    };
    mockRoles.push(newRole);
    return { success: true, data: newRole };
  },

  async updateRole(id, body) {
    await delay(400);
    const idx = mockRoles.findIndex(r => r.id === id);
    if (idx === -1) throw new ApiError(404, 'Role not found');
    mockRoles[idx] = { ...mockRoles[idx], ...body };
    return { success: true, data: mockRoles[idx] };
  },

  async deleteRole(id) {
    await delay(400);
    const idx = mockRoles.findIndex(r => r.id === id);
    if (idx === -1) throw new ApiError(404, 'Role not found');
    const activeCount = mockWorkers.filter(w => w.role_id === id && w.is_active).length;
    if (activeCount > 0) {
      throw new ApiError(409, `Cannot delete role: ${activeCount} active worker(s) assigned`);
    }
    mockRoles.splice(idx, 1);
    return { success: true, message: 'Role deleted' };
  },

  async getRolePpe(id) {
    await delay();
    const role = mockRoles.find(r => r.id === id);
    if (!role) throw new ApiError(404, 'Role not found');
    const ppe_items = mockPpeItems.filter(p => role.required_ppe.includes(p.id));
    return { success: true, data: { role_id: role.id, role_name: role.role_name, ppe_items } };
  },

  async replaceRolePpe(id, body) {
    await delay(400);
    const idx = mockRoles.findIndex(r => r.id === id);
    if (idx === -1) throw new ApiError(404, 'Role not found');
    mockRoles[idx].required_ppe = body.ppe_item_ids;
    const ppe_items = mockPpeItems.filter(p => body.ppe_item_ids.includes(p.id));
    return { success: true, data: { role_id: id, role_name: mockRoles[idx].role_name, ppe_items } };
  },

  async listPpeItems() {
    await delay();
    return { success: true, data: [...mockPpeItems] };
  },

  async createPpeItem(body) {
    await delay(400);
    if (mockPpeItems.some(p => p.item_key === body.item_key)) {
      throw new ApiError(409, 'PPE item key already exists');
    }
    const newItem = {
      id: nextPpeId++,
      item_key: body.item_key,
      display_name: body.display_name,
      icon_name: body.icon_name || null,
    };
    mockPpeItems.push(newItem);
    return { success: true, data: newItem };
  },

  async deletePpeItem(id) {
    await delay(400);
    const idx = mockPpeItems.findIndex(p => p.id === id);
    if (idx === -1) throw new ApiError(404, 'PPE item not found');
    const usingRoles = mockRoles.filter(r => r.required_ppe.includes(id));
    if (usingRoles.length > 0) {
      throw new ApiError(409, `Cannot delete: used by ${usingRoles.length} role(s)`);
    }
    mockPpeItems.splice(idx, 1);
    return { success: true, message: 'PPE item deleted' };
  },

  async listEntryLogs(query = {}) {
    await delay();
    let data = [...mockEntryLogs];
    if (query.result) data = data.filter(l => l.result === query.result);
    if (query.worker_id) data = data.filter(l => l.worker_id === query.worker_id);
    if (query.start_date) data = data.filter(l => l.scanned_at >= query.start_date);
    if (query.end_date) data = data.filter(l => l.scanned_at <= `${query.end_date}T23:59:59Z`);
    data.sort((a, b) => new Date(b.scanned_at) - new Date(a.scanned_at));
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    return { success: true, data: data.slice(offset, offset + limit), total: data.length, limit, offset };
  },

  async getEntryLogStats(query = {}) {
    await delay();
    let logs = [...mockEntryLogs];
    if (query.start_date) logs = logs.filter(l => l.scanned_at >= query.start_date);
    if (query.end_date) logs = logs.filter(l => l.scanned_at <= `${query.end_date}T23:59:59Z`);

    const total_scans = logs.length;
    const passed = logs.filter(l => l.result === 'PASS').length;
    const failed = logs.filter(l => l.result === 'FAIL').length;
    const unknown_cards = logs.filter(l => l.result === 'UNKNOWN_CARD').length;
    const compliance_rate = passed + failed > 0 ? Math.round((passed / (passed + failed)) * 1000) / 10 : 0;

    const missMap = {};
    logs.forEach(l => l.missing_ppe.forEach(item => {
      const k = item.item_key;
      if (!missMap[k]) missMap[k] = { item_key: k, display_name: item.display_name, miss_count: 0 };
      missMap[k].miss_count++;
    }));
    const most_missed_ppe = Object.values(missMap).sort((a, b) => b.miss_count - a.miss_count);

    const dailyMap = {};
    logs.forEach(l => {
      const date = l.scanned_at.split('T')[0];
      if (!dailyMap[date]) dailyMap[date] = { date, pass: 0, fail: 0, total: 0 };
      if (l.result === 'PASS') dailyMap[date].pass++;
      if (l.result === 'FAIL') dailyMap[date].fail++;
      dailyMap[date].total++;
    });
    const daily_data = Object.values(dailyMap)
      .map(d => ({ ...d, rate: d.pass + d.fail > 0 ? Math.round((d.pass / (d.pass + d.fail)) * 1000) / 10 : 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      success: true,
      data: {
        total_scans, passed, failed, unknown_cards, compliance_rate,
        most_missed_ppe, daily_data,
        period: { start_date: query.start_date || null, end_date: query.end_date || null },
      },
    };
  },
};

// ── Real API implementations (used when VITE_USE_MOCK=false) ───

const realApi = {
  listWorkers(query = {}) {
    const params = new URLSearchParams();
    if (query.is_active !== undefined) params.set('is_active', query.is_active);
    if (query.role_id !== undefined) params.set('role_id', query.role_id);
    return apiFetch(`/api/workers?${params}`);
  },
  createWorker(body) { return apiFetch('/api/workers', { method: 'POST', body: JSON.stringify(body) }); },
  getWorkerById(id) { return apiFetch(`/api/workers/${id}`); },
  updateWorker(id, body) { return apiFetch(`/api/workers/${id}`, { method: 'PUT', body: JSON.stringify(body) }); },
  softDeleteWorker(id) { return apiFetch(`/api/workers/${id}`, { method: 'DELETE' }); },
  lookupWorkerByCard(uid) { return apiFetch(`/api/workers/card/${uid}`); },
  async listRoles() {
    const [rolesRes, ppeRes, workersRes] = await Promise.all([
      apiFetch('/api/roles'),
      apiFetch('/api/ppe-items'),
      apiFetch('/api/workers').catch(() => ({ success: true, data: [] })),
    ]);
    const allPpe = ppeRes.data || [];
    const allWorkers = workersRes.data || [];
    // Enrich each role with ppe_items and worker_count
    const enriched = await Promise.all(
      (rolesRes.data || []).map(async (role) => {
        let ppe_items = [];
        try {
          const ppeRes2 = await apiFetch(`/api/roles/${role.id}/ppe`);
          ppe_items = ppeRes2.data?.ppe_items || [];
        } catch { ppe_items = []; }
        const worker_count = allWorkers.filter(w => w.role_id === role.id && w.is_active).length;
        return { ...role, ppe_items, worker_count, required_ppe: ppe_items.map(p => p.id) };
      })
    );
    return { success: true, data: enriched };
  },
  createRole(body) { return apiFetch('/api/roles', { method: 'POST', body: JSON.stringify(body) }); },
  updateRole(id, body) { return apiFetch(`/api/roles/${id}`, { method: 'PUT', body: JSON.stringify(body) }); },
  deleteRole(id) { return apiFetch(`/api/roles/${id}`, { method: 'DELETE' }); },
  getRolePpe(id) { return apiFetch(`/api/roles/${id}/ppe`); },
  replaceRolePpe(id, body) { return apiFetch(`/api/roles/${id}/ppe`, { method: 'PUT', body: JSON.stringify(body) }); },
  listPpeItems() { return apiFetch('/api/ppe-items'); },
  createPpeItem(body) { return apiFetch('/api/ppe-items', { method: 'POST', body: JSON.stringify(body) }); },
  deletePpeItem(id) { return apiFetch(`/api/ppe-items/${id}`, { method: 'DELETE' }); },
  listEntryLogs(query = {}) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => v !== undefined && params.set(k, v));
    return apiFetch(`/api/entry-logs?${params}`);
  },
  getEntryLogStats(query = {}) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => v !== undefined && params.set(k, v));
    return apiFetch(`/api/entry-logs/stats?${params}`);
  },
};

// ── Proxy: dynamically pick mock or real based on settings ─────

export const api = new Proxy({}, {
  get(_, method) {
    return (...args) => {
      const { useMock } = getSettings();
      const target = useMock ? mockApi : realApi;
      return target[method](...args);
    };
  },
});
