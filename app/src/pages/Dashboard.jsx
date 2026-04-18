import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Users, ScanLine, ShieldCheck, AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function StatCard({ icon: Icon, label, value, sub, color }) {
  const colorMap = {
    blue: 'bg-primary-50 text-primary-600',
    green: 'bg-success-50 text-success-600',
    red: 'bg-danger-50 text-danger-600',
    amber: 'bg-warning-50 text-warning-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg ${colorMap[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

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

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.getStats().then(data => {
      setStats(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">PPE Inspection Station overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Active Workers" value={stats.totalWorkers} sub="Registered in system" color="blue" />
        <StatCard icon={ScanLine} label="Today's Scans" value={stats.todayScans} sub="Since midnight" color="green" />
        <StatCard icon={ShieldCheck} label="Compliance Rate" value={`${stats.complianceRate}%`} sub={`${stats.passed} of ${stats.totalScans} passed`} color="green" />
        <StatCard icon={AlertTriangle} label="Failed Today" value={stats.failed} sub={stats.mostMissed[0] ? `Top miss: ${stats.mostMissed[0].displayName}` : 'No failures'} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
            <button onClick={() => navigate('/logs')} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.recentLogs.map(log => (
              <div key={log.id} className="px-5 py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  log.result === 'PASS' ? 'bg-success-50 text-success-600' :
                  log.result === 'FAIL' ? 'bg-danger-50 text-danger-600' :
                  'bg-warning-50 text-warning-600'
                }`}>
                  {log.workerName?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {log.workerName || 'Unknown Card'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(log.scannedAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                    {log.role && ` · ${log.role}`}
                  </p>
                </div>
                <ResultBadge result={log.result} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Most Missed PPE Items</h2>
          </div>
          <div className="p-5 space-y-4">
            {stats.mostMissed.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No missing items recorded</p>
            ) : (
              stats.mostMissed.map((item, i) => {
                const maxCount = stats.mostMissed[0]?.count || 1;
                const pct = Math.round((item.count / maxCount) * 100);
                return (
                  <div key={item.item}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{item.displayName}</span>
                      <span className="text-sm text-gray-400">{item.count} times</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${i === 0 ? 'bg-danger-500' : 'bg-warning-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
