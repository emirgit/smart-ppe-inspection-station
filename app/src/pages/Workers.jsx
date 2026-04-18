import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Search, Pencil, UserX, X, CreditCard } from 'lucide-react';

function StatusBadge({ active }) {
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
      active
        ? 'bg-success-50 text-success-600 border-success-100'
        : 'bg-gray-50 text-gray-400 border-gray-200'
    }`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function RegisterModal({ isOpen, onClose, onSave, roles }) {
  const [form, setForm] = useState({ fullName: '', rfidCardUid: '', roleId: '' });
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName || !form.rfidCardUid || !form.roleId) return;
    setSaving(true);
    await onSave({ ...form, roleId: Number(form.roleId) });
    setSaving(false);
    setForm({ fullName: '', rfidCardUid: '', roleId: '' });
  };

  const simulateRfidScan = () => {
    const uid = Array.from({ length: 8 }, () => 'ABCDEF0123456789'[Math.floor(Math.random() * 16)]).join('');
    setForm(f => ({ ...f, rfidCardUid: uid }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Register New Worker</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter worker name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">RFID Card UID</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.rfidCardUid}
                readOnly
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono bg-gray-50 text-gray-700"
                placeholder="Scan a card..."
              />
              <button
                type="button"
                onClick={simulateRfidScan}
                className="px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Scan
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Place card on RC522 reader or click Scan to simulate</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Role</label>
            <select
              value={form.roleId}
              onChange={(e) => setForm(f => ({ ...f, roleId: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            >
              <option value="">Select a role...</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.roleName}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50">
              {saving ? 'Registering...' : 'Register Worker'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    Promise.all([api.getWorkers(), api.getRoles()]).then(([w, r]) => {
      setWorkers(w);
      setRoles(r);
      setLoading(false);
    });
  }, []);

  const handleRegister = async (data) => {
    const newWorker = await api.createWorker(data);
    setWorkers(prev => [...prev, newWorker]);
    setShowRegister(false);
  };

  const handleDeactivate = async (id) => {
    if (!confirm('Deactivate this worker? They will no longer pass the turnstile.')) return;
    await api.deleteWorker(id);
    setWorkers(prev => prev.map(w => w.id === id ? { ...w, isActive: false } : w));
  };

  const filtered = workers.filter(w => {
    if (search && !w.fullName.toLowerCase().includes(search.toLowerCase()) && !w.rfidCardUid.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRole !== 'ALL' && w.roleName !== filterRole) return false;
    if (filterStatus === 'ACTIVE' && !w.isActive) return false;
    if (filterStatus === 'INACTIVE' && w.isActive) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-12 bg-gray-200 rounded-lg" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workers</h1>
          <p className="text-sm text-gray-500 mt-1">{workers.filter(w => w.isActive).length} active workers registered</p>
        </div>
        <button
          onClick={() => setShowRegister(true)}
          className="px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Register Worker
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Search by name or RFID..."
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="ALL">All Roles</option>
          {roles.map(r => <option key={r.id} value={r.roleName}>{r.roleName}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">RFID UID</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Registered</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(w => (
              <tr key={w.id} className="hover:bg-gray-50/50 transition">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      w.isActive ? 'bg-primary-50 text-primary-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {w.fullName[0]}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{w.fullName}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <code className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded">{w.rfidCardUid}</code>
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{w.roleName}</td>
                <td className="px-5 py-3.5"><StatusBadge active={w.isActive} /></td>
                <td className="px-5 py-3.5 text-sm text-gray-400">
                  {new Date(w.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button className="p-1.5 rounded-lg hover:bg-gray-100 transition" title="Edit">
                      <Pencil className="w-4 h-4 text-gray-400" />
                    </button>
                    {w.isActive && (
                      <button
                        onClick={() => handleDeactivate(w.id)}
                        className="p-1.5 rounded-lg hover:bg-danger-50 transition"
                        title="Deactivate"
                      >
                        <UserX className="w-4 h-4 text-gray-400 hover:text-danger-500" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">
                  No workers found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <RegisterModal
        isOpen={showRegister}
        onClose={() => setShowRegister(false)}
        onSave={handleRegister}
        roles={roles}
      />
    </div>
  );
}
