// Mock API Service for Admin Panel
// Will be replaced with real fetch() calls to MOD-04 Express.js backend.
// Interface contract: admin_side_interface.d.ts

const ppeItems = [
  { id: 1, itemKey: 'hard_hat', displayName: 'Hard Hat', iconName: 'hard-hat' },
  { id: 2, itemKey: 'safety_vest', displayName: 'Safety Vest', iconName: 'vest' },
  { id: 3, itemKey: 'gloves', displayName: 'Gloves', iconName: 'gloves' },
  { id: 4, itemKey: 'safety_boots', displayName: 'Safety Boots', iconName: 'boots' },
  { id: 5, itemKey: 'face_mask', displayName: 'Face Mask', iconName: 'mask' },
  { id: 6, itemKey: 'safety_goggles', displayName: 'Safety Goggles', iconName: 'goggles' },
];

const roles = [
  { id: 1, roleName: 'Construction Worker', description: 'General construction site worker', requiredPpe: ['hard_hat', 'safety_vest', 'gloves', 'safety_boots'] },
  { id: 2, roleName: 'Technician', description: 'Equipment maintenance technician', requiredPpe: ['hard_hat', 'safety_vest', 'safety_goggles'] },
  { id: 3, roleName: 'Visitor', description: 'Site visitor with basic PPE', requiredPpe: ['hard_hat', 'safety_vest'] },
  { id: 4, roleName: 'Electrician', description: 'Electrical systems worker', requiredPpe: ['hard_hat', 'safety_vest', 'gloves', 'safety_goggles'] },
];

let workers = [
  { id: 1, fullName: 'Ahmet Yılmaz', rfidCardUid: 'A1B2C3D4', roleId: 1, roleName: 'Construction Worker', isActive: true, createdAt: '2026-03-01T08:00:00Z' },
  { id: 2, fullName: 'Fatma Demir', rfidCardUid: 'E5F6G7H8', roleId: 2, roleName: 'Technician', isActive: true, createdAt: '2026-03-02T09:30:00Z' },
  { id: 3, fullName: 'Mehmet Kaya', rfidCardUid: 'I9J0K1L2', roleId: 3, roleName: 'Visitor', isActive: true, createdAt: '2026-03-05T10:00:00Z' },
  { id: 4, fullName: 'Zeynep Aydın', rfidCardUid: 'M3N4O5P6', roleId: 4, roleName: 'Electrician', isActive: true, createdAt: '2026-03-08T11:15:00Z' },
  { id: 5, fullName: 'Ali Çelik', rfidCardUid: 'Q7R8S9T0', roleId: 1, roleName: 'Construction Worker', isActive: false, createdAt: '2026-02-20T07:00:00Z' },
  { id: 6, fullName: 'Elif Yıldız', rfidCardUid: 'U1V2W3X4', roleId: 2, roleName: 'Technician', isActive: true, createdAt: '2026-03-10T08:45:00Z' },
  { id: 7, fullName: 'Hasan Özdemir', rfidCardUid: 'Y5Z6A7B8', roleId: 1, roleName: 'Construction Worker', isActive: true, createdAt: '2026-03-12T09:00:00Z' },
  { id: 8, fullName: 'Ayşe Koç', rfidCardUid: 'C9D0E1F2', roleId: 3, roleName: 'Visitor', isActive: true, createdAt: '2026-03-15T14:00:00Z' },
];

const entryLogs = [
  { id: 1, workerId: 1, workerName: 'Ahmet Yılmaz', rfidUid: 'A1B2C3D4', role: 'Construction Worker', result: 'PASS', missingItems: [], scannedAt: '2026-03-20T08:15:00Z', inspectionTimeMs: 3200 },
  { id: 2, workerId: 2, workerName: 'Fatma Demir', rfidUid: 'E5F6G7H8', role: 'Technician', result: 'FAIL', missingItems: ['safety_goggles'], scannedAt: '2026-03-20T08:22:00Z', inspectionTimeMs: 4100 },
  { id: 3, workerId: 1, workerName: 'Ahmet Yılmaz', rfidUid: 'A1B2C3D4', role: 'Construction Worker', result: 'PASS', missingItems: [], scannedAt: '2026-03-20T09:00:00Z', inspectionTimeMs: 2800 },
  { id: 4, workerId: null, workerName: null, rfidUid: 'UNKNOWN01', role: null, result: 'UNKNOWN_CARD', missingItems: [], scannedAt: '2026-03-20T09:15:00Z', inspectionTimeMs: null },
  { id: 5, workerId: 3, workerName: 'Mehmet Kaya', rfidUid: 'I9J0K1L2', role: 'Visitor', result: 'PASS', missingItems: [], scannedAt: '2026-03-20T09:30:00Z', inspectionTimeMs: 2100 },
  { id: 6, workerId: 4, workerName: 'Zeynep Aydın', rfidUid: 'M3N4O5P6', role: 'Electrician', result: 'FAIL', missingItems: ['gloves', 'safety_goggles'], scannedAt: '2026-03-20T10:05:00Z', inspectionTimeMs: 3900 },
  { id: 7, workerId: 2, workerName: 'Fatma Demir', rfidUid: 'E5F6G7H8', role: 'Technician', result: 'PASS', missingItems: [], scannedAt: '2026-03-20T10:30:00Z', inspectionTimeMs: 2500 },
  { id: 8, workerId: 1, workerName: 'Ahmet Yılmaz', rfidUid: 'A1B2C3D4', role: 'Construction Worker', result: 'FAIL', missingItems: ['gloves'], scannedAt: '2026-03-19T08:10:00Z', inspectionTimeMs: 3600 },
  { id: 9, workerId: 3, workerName: 'Mehmet Kaya', rfidUid: 'I9J0K1L2', role: 'Visitor', result: 'PASS', missingItems: [], scannedAt: '2026-03-19T09:20:00Z', inspectionTimeMs: 1900 },
  { id: 10, workerId: 4, workerName: 'Zeynep Aydın', rfidUid: 'M3N4O5P6', role: 'Electrician', result: 'PASS', missingItems: [], scannedAt: '2026-03-19T10:00:00Z', inspectionTimeMs: 2700 },
  { id: 11, workerId: 7, workerName: 'Hasan Özdemir', rfidUid: 'Y5Z6A7B8', role: 'Construction Worker', result: 'PASS', missingItems: [], scannedAt: '2026-03-19T11:30:00Z', inspectionTimeMs: 2400 },
  { id: 12, workerId: 6, workerName: 'Elif Yıldız', rfidUid: 'U1V2W3X4', role: 'Technician', result: 'FAIL', missingItems: ['safety_goggles'], scannedAt: '2026-03-18T08:45:00Z', inspectionTimeMs: 3700 },
  { id: 13, workerId: 1, workerName: 'Ahmet Yılmaz', rfidUid: 'A1B2C3D4', role: 'Construction Worker', result: 'PASS', missingItems: [], scannedAt: '2026-03-18T09:10:00Z', inspectionTimeMs: 2600 },
  { id: 14, workerId: 8, workerName: 'Ayşe Koç', rfidUid: 'C9D0E1F2', role: 'Visitor', result: 'PASS', missingItems: [], scannedAt: '2026-03-18T14:20:00Z', inspectionTimeMs: 1800 },
  { id: 15, workerId: 4, workerName: 'Zeynep Aydın', rfidUid: 'M3N4O5P6', role: 'Electrician', result: 'FAIL', missingItems: ['gloves'], scannedAt: '2026-03-17T08:30:00Z', inspectionTimeMs: 3500 },
];

const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));

export const api = {
  async getWorkers() {
    await delay();
    return [...workers];
  },

  async getWorker(id) {
    await delay();
    return workers.find(w => w.id === id) || null;
  },

  async createWorker(data) {
    await delay(500);
    const role = roles.find(r => r.id === data.roleId);
    const newWorker = {
      id: workers.length + 1,
      fullName: data.fullName,
      rfidCardUid: data.rfidCardUid,
      roleId: data.roleId,
      roleName: role?.roleName || 'Unknown',
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    workers = [...workers, newWorker];
    return newWorker;
  },

  async updateWorker(id, data) {
    await delay(400);
    workers = workers.map(w => w.id === id ? { ...w, ...data } : w);
    return workers.find(w => w.id === id);
  },

  async deleteWorker(id) {
    await delay(400);
    workers = workers.map(w => w.id === id ? { ...w, isActive: false } : w);
    return { success: true };
  },

  async getRoles() {
    await delay();
    return [...roles];
  },

  async getPpeItems() {
    await delay();
    return [...ppeItems];
  },

  async getEntryLogs(filters = {}) {
    await delay();
    let logs = [...entryLogs];
    if (filters.result && filters.result !== 'ALL') {
      logs = logs.filter(l => l.result === filters.result);
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      logs = logs.filter(l => l.workerName?.toLowerCase().includes(s) || l.rfidUid?.toLowerCase().includes(s));
    }
    return logs.sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt));
  },

  async getStats() {
    await delay();
    const total = entryLogs.length;
    const passed = entryLogs.filter(l => l.result === 'PASS').length;
    const failed = entryLogs.filter(l => l.result === 'FAIL').length;
    const unknown = entryLogs.filter(l => l.result === 'UNKNOWN_CARD').length;
    const todayLogs = entryLogs.filter(l => l.scannedAt.startsWith('2026-03-20'));

    const missCounts = {};
    entryLogs.forEach(l => {
      l.missingItems.forEach(item => {
        missCounts[item] = (missCounts[item] || 0) + 1;
      });
    });
    const mostMissed = Object.entries(missCounts)
      .map(([item, count]) => ({ item, displayName: ppeItems.find(p => p.itemKey === item)?.displayName || item, count }))
      .sort((a, b) => b.count - a.count);

    const dailyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date('2026-03-20');
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayLogs = entryLogs.filter(l => l.scannedAt.startsWith(dateStr));
      const dayPass = dayLogs.filter(l => l.result === 'PASS').length;
      const dayFail = dayLogs.filter(l => l.result === 'FAIL').length;
      dailyData.push({
        date: dateStr,
        label: date.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }),
        pass: dayPass,
        fail: dayFail,
        total: dayPass + dayFail,
        rate: dayPass + dayFail > 0 ? Math.round((dayPass / (dayPass + dayFail)) * 100) : 0,
      });
    }

    return {
      totalWorkers: workers.filter(w => w.isActive).length,
      todayScans: todayLogs.length,
      complianceRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      totalScans: total,
      passed,
      failed,
      unknown,
      mostMissed,
      dailyData,
      recentLogs: entryLogs.sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt)).slice(0, 5),
    };
  },
};
