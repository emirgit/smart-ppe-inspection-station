import * as mock from './mock-data'

const delay = (ms = 250) => new Promise(r => setTimeout(r, ms))

export class ApiError extends Error {
  constructor(code, message) {
    super(message); this.code = code; this.name = 'ApiError'
  }
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001'
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

async function apiFetch(path, options = {}) {
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: controller.signal,
    })
    clearTimeout(tid)
    const json = await res.json()
    if (!res.ok || !json.success) throw new ApiError(json.error?.code || res.status, json.error?.message || `HTTP ${res.status}`)
    return json
  } catch (err) {
    clearTimeout(tid)
    if (err.name === 'AbortError') throw new ApiError(0, 'İstek zaman aşımına uğradı')
    if (err instanceof ApiError) throw err
    throw new ApiError(0, err.message || 'Ağ hatası')
  }
}

let mockWorkers   = [...mock.workers]
let mockRoles     = [...mock.roles]
let mockPpeItems  = [...mock.ppeItems]
let mockEntryLogs = [...mock.entryLogs]
let nextWorkerId  = mockWorkers.length + 1
let nextRoleId    = mockRoles.length + 1
let nextPpeId     = mockPpeItems.length + 1

const mockApi = {
  async listWorkers(q = {}) {
    await delay(); let data = [...mockWorkers]
    if (q.is_active !== undefined) data = data.filter(w => w.is_active === q.is_active)
    if (q.role_id !== undefined) data = data.filter(w => w.role_id === q.role_id)
    return { success: true, data, total: data.length }
  },
  async createWorker(body) {
    await delay(400)
    if (mockWorkers.some(w => w.rfid_card_uid === body.rfid_card_uid)) throw new ApiError(409, 'Bu RFID kart zaten kayıtlı')
    const role = mockRoles.find(r => r.id === body.role_id)
    if (!role) throw new ApiError(404, 'Rol bulunamadı')
    const w = { id: nextWorkerId++, ...body, role_name: role.role_name, is_active: true, photo_url: null, created_at: new Date().toISOString() }
    mockWorkers.push(w); return { success: true, data: w }
  },
  async getWorkerById(id) {
    await delay(); const w = mockWorkers.find(w => w.id === id)
    if (!w) throw new ApiError(404, 'Çalışan bulunamadı')
    return { success: true, data: w }
  },
  async updateWorker(id, body) {
    await delay(400); const idx = mockWorkers.findIndex(w => w.id === id)
    if (idx === -1) throw new ApiError(404, 'Çalışan bulunamadı')
    if (body.rfid_card_uid && mockWorkers.some(w => w.id !== id && w.rfid_card_uid === body.rfid_card_uid)) throw new ApiError(409, 'Bu RFID kart zaten kayıtlı')
    const updated = { ...mockWorkers[idx], ...body, updated_at: new Date().toISOString() }
    if (body.role_id) { const role = mockRoles.find(r => r.id === body.role_id); if (role) updated.role_name = role.role_name }
    mockWorkers[idx] = updated; return { success: true, data: updated }
  },
  async softDeleteWorker(id) {
    await delay(400); const idx = mockWorkers.findIndex(w => w.id === id)
    if (idx === -1) throw new ApiError(404, 'Çalışan bulunamadı')
    mockWorkers[idx].is_active = false; return { success: true, data: { id, is_active: false } }
  },
  async listRoles() {
    await delay()
    return { success: true, data: mockRoles.map(r => ({ ...r, ppe_items: mockPpeItems.filter(p => r.required_ppe.includes(p.id)), worker_count: mockWorkers.filter(w => w.role_id === r.id && w.is_active).length })) }
  },
  async createRole(body) {
    await delay(400)
    if (mockRoles.some(r => r.role_name.toLowerCase() === body.role_name.toLowerCase())) throw new ApiError(409, 'Bu rol adı zaten mevcut')
    const r = { id: nextRoleId++, role_name: body.role_name, description: body.description || null, required_ppe: [], created_at: new Date().toISOString() }
    mockRoles.push(r); return { success: true, data: r }
  },
  async updateRole(id, body) {
    await delay(400); const idx = mockRoles.findIndex(r => r.id === id)
    if (idx === -1) throw new ApiError(404, 'Rol bulunamadı')
    mockRoles[idx] = { ...mockRoles[idx], ...body }; return { success: true, data: mockRoles[idx] }
  },
  async deleteRole(id) {
    await delay(400); const idx = mockRoles.findIndex(r => r.id === id)
    if (idx === -1) throw new ApiError(404, 'Rol bulunamadı')
    const active = mockWorkers.filter(w => w.role_id === id && w.is_active).length
    if (active > 0) throw new ApiError(409, `Bu role atanmış ${active} aktif çalışan var`)
    mockRoles.splice(idx, 1); return { success: true }
  },
  async getRolePpe(id) {
    await delay(); const role = mockRoles.find(r => r.id === id)
    if (!role) throw new ApiError(404, 'Rol bulunamadı')
    return { success: true, data: { role_id: role.id, role_name: role.role_name, ppe_items: mockPpeItems.filter(p => role.required_ppe.includes(p.id)) } }
  },
  async replaceRolePpe(id, body) {
    await delay(400); const idx = mockRoles.findIndex(r => r.id === id)
    if (idx === -1) throw new ApiError(404, 'Rol bulunamadı')
    mockRoles[idx].required_ppe = body.ppe_item_ids
    return { success: true, data: { role_id: id, role_name: mockRoles[idx].role_name, ppe_items: mockPpeItems.filter(p => body.ppe_item_ids.includes(p.id)) } }
  },
  async listPpeItems() { await delay(); return { success: true, data: [...mockPpeItems] } },
  async createPpeItem(body) {
    await delay(400)
    if (mockPpeItems.some(p => p.item_key === body.item_key)) throw new ApiError(409, 'Bu item_key zaten mevcut')
    const item = { id: nextPpeId++, ...body }; mockPpeItems.push(item); return { success: true, data: item }
  },
  async updatePpeItem(id, body) {
    await delay(400); const idx = mockPpeItems.findIndex(p => p.id === id)
    if (idx === -1) throw new ApiError(404, 'PPE item bulunamadı')
    mockPpeItems[idx] = { ...mockPpeItems[idx], ...body }; return { success: true, data: mockPpeItems[idx] }
  },
  async deletePpeItem(id) {
    await delay(400); const idx = mockPpeItems.findIndex(p => p.id === id)
    if (idx === -1) throw new ApiError(404, 'PPE item bulunamadı')
    const using = mockRoles.filter(r => r.required_ppe.includes(id))
    if (using.length > 0) throw new ApiError(409, `${using.length} rol tarafından kullanılıyor`)
    mockPpeItems.splice(idx, 1); return { success: true }
  },
  async listEntryLogs(q = {}) {
    await delay(); let data = [...mockEntryLogs]
    if (q.result) data = data.filter(l => l.result === q.result)
    if (q.worker_id) data = data.filter(l => l.worker_id === q.worker_id)
    if (q.start_date) data = data.filter(l => l.scanned_at >= q.start_date)
    if (q.end_date) data = data.filter(l => l.scanned_at <= `${q.end_date}T23:59:59Z`)
    data.sort((a, b) => new Date(b.scanned_at) - new Date(a.scanned_at))
    const limit = q.limit || 50, offset = q.offset || 0
    return { success: true, data: data.slice(offset, offset + limit), total: data.length, limit, offset }
  },
  async getEntryLogStats(q = {}) {
    await delay(); let logs = [...mockEntryLogs]
    if (q.start_date) logs = logs.filter(l => l.scanned_at >= q.start_date)
    if (q.end_date) logs = logs.filter(l => l.scanned_at <= `${q.end_date}T23:59:59Z`)
    const passed = logs.filter(l => l.result === 'PASS').length
    const failed = logs.filter(l => l.result === 'FAIL').length
    const unknown = logs.filter(l => l.result === 'UNKNOWN_CARD').length
    const compliance_rate = passed + failed > 0 ? Math.round((passed / (passed + failed)) * 1000) / 10 : 0
    const missMap = {}
    logs.forEach(l => l.missing_ppe.forEach(item => {
      if (!missMap[item.item_key]) missMap[item.item_key] = { item_key: item.item_key, display_name: item.display_name, miss_count: 0 }
      missMap[item.item_key].miss_count++
    }))
    const most_missed_ppe = Object.values(missMap).sort((a, b) => b.miss_count - a.miss_count)
    const dailyMap = {}
    logs.forEach(l => {
      const date = l.scanned_at.split('T')[0]
      if (!dailyMap[date]) dailyMap[date] = { date, pass: 0, fail: 0, total: 0 }
      if (l.result === 'PASS') dailyMap[date].pass++
      if (l.result === 'FAIL') dailyMap[date].fail++
      dailyMap[date].total++
    })
    const daily_data = Object.values(dailyMap)
      .map(d => ({ ...d, rate: d.pass + d.fail > 0 ? Math.round((d.pass / (d.pass + d.fail)) * 1000) / 10 : 0 }))
      .sort((a, b) => a.date.localeCompare(b.date))
    return { success: true, data: { total_scans: logs.length, passed, failed, unknown_cards: unknown, compliance_rate, most_missed_ppe, daily_data } }
  },
}

const realApi = {
  listWorkers(q = {}) {
    const p = new URLSearchParams()
    if (q.is_active !== undefined) p.set('is_active', q.is_active)
    if (q.role_id !== undefined) p.set('role_id', q.role_id)
    return apiFetch(`/api/workers?${p}`)
  },
  createWorker(body)     { return apiFetch('/api/workers', { method: 'POST', body: JSON.stringify(body) }) },
  getWorkerById(id)      { return apiFetch(`/api/workers/${id}`) },
  updateWorker(id, body) { return apiFetch(`/api/workers/${id}`, { method: 'PUT', body: JSON.stringify(body) }) },
  softDeleteWorker(id)   { return apiFetch(`/api/workers/${id}`, { method: 'DELETE' }) },
  async listRoles() {
    const [rr, pr, wr] = await Promise.all([apiFetch('/api/roles'), apiFetch('/api/ppe-items'), apiFetch('/api/workers').catch(() => ({ data: [] }))])
    const allWorkers = wr.data || []
    const enriched = await Promise.all((rr.data || []).map(async role => {
      let ppe_items = []
      try { const r = await apiFetch(`/api/roles/${role.id}/ppe`); ppe_items = r.data?.ppe_items || [] } catch {}
      return { ...role, ppe_items, worker_count: allWorkers.filter(w => w.role_id === role.id && w.is_active).length, required_ppe: ppe_items.map(p => p.id) }
    }))
    return { success: true, data: enriched }
  },
  createRole(body)         { return apiFetch('/api/roles', { method: 'POST', body: JSON.stringify(body) }) },
  updateRole(id, body)     { return apiFetch(`/api/roles/${id}`, { method: 'PUT', body: JSON.stringify(body) }) },
  deleteRole(id)           { return apiFetch(`/api/roles/${id}`, { method: 'DELETE' }) },
  getRolePpe(id)           { return apiFetch(`/api/roles/${id}/ppe`) },
  replaceRolePpe(id, body) { return apiFetch(`/api/roles/${id}/ppe`, { method: 'PUT', body: JSON.stringify(body) }) },
  listPpeItems()           { return apiFetch('/api/ppe-items') },
  createPpeItem(body)      { return apiFetch('/api/ppe-items', { method: 'POST', body: JSON.stringify(body) }) },
  updatePpeItem(id, body)  { return apiFetch(`/api/ppe-items/${id}`, { method: 'PUT', body: JSON.stringify(body) }) },
  deletePpeItem(id)        { return apiFetch(`/api/ppe-items/${id}`, { method: 'DELETE' }) },
  listEntryLogs(q = {}) {
    const p = new URLSearchParams()
    Object.entries(q).forEach(([k, v]) => v !== undefined && p.set(k, v))
    return apiFetch(`/api/entry-logs?${p}`)
  },
  getEntryLogStats(q = {}) {
    const p = new URLSearchParams()
    Object.entries(q).forEach(([k, v]) => v !== undefined && p.set(k, v))
    return apiFetch(`/api/entry-logs/stats?${p}`)
  },
}

export const api = new Proxy({}, {
  get(_, method) {
    return (...args) => (USE_MOCK ? mockApi : realApi)[method](...args)
  },
})
