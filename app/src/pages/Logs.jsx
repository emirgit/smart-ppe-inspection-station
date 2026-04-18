import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Search } from 'lucide-react';

function ResultBadge({ result }) {
  const styles = {
    PASS: 'bg-success-50 text-success-600 border-success-200',
    FAIL: 'bg-danger-50 text-danger-600 border-danger-200',
    UNKNOWN_CARD: 'bg-warning-50 text-warning-600 border-warning-200',
  };
  const labels = { PASS: 'Pass', FAIL: 'Fail', UNKNOWN_CARD: 'Unknown' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[result] || ''}`}>
      {labels[result] || result}
    </span>
  );
}

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('ALL');

  useEffect(() => {
    loadLogs();
  }, [resultFilter, search]);

  const loadLogs = async () => {
    setLoading(true);
    const data = await api.getEntryLogs({
      result: resultFilter === 'ALL' ? undefined : resultFilter,
      search: search || undefined,
    });
    setLogs(data);
    setLoading(false);
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Entry Logs</h1>
        <p className="text-sm text-gray-500 mt-1">History of all inspection events at the turnstile</p>
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
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="ALL">All Results</option>
          <option value="PASS">Pass Only</option>
          <option value="FAIL">Fail Only</option>
          <option value="UNKNOWN_CARD">Unknown Cards</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Worker</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Result</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Missing Items</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-400">Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">No logs found.</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50/50 transition">
                <td className="px-5 py-3.5 text-sm text-gray-600">
                  {new Date(log.scannedAt).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-5 py-3.5 text-sm font-medium text-gray-900">
                  {log.workerName || <span className="text-gray-400 italic">Unknown</span>}
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{log.role || '—'}</td>
                <td className="px-5 py-3.5"><ResultBadge result={log.result} /></td>
                <td className="px-5 py-3.5">
                  {log.missingItems.length === 0 ? (
                    <span className="text-xs text-gray-300">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {log.missingItems.map(item => (
                        <span key={item} className="px-1.5 py-0.5 bg-danger-50 text-danger-600 text-xs rounded border border-danger-100">
                          {item.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-400">
                  {log.inspectionTimeMs ? `${(log.inspectionTimeMs / 1000).toFixed(1)}s` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
