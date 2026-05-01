import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ScanLine, ShieldCheck, AlertTriangle, ArrowRight, ClipboardList } from 'lucide-react';
import { api } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/stat-card';
import { ResultBadge } from '@/components/result-badge';
import { ErrorState } from '@/components/error-state';
import { EmptyState } from '@/components/empty-state';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const today = new Date().toISOString().split('T')[0];
      const [statsRes, todayRes, workersRes, recentRes] = await Promise.all([
        api.getEntryLogStats(),
        api.getEntryLogStats({ start_date: today, end_date: today }),
        api.listWorkers({ is_active: true }),
        api.listEntryLogs({ limit: 5, offset: 0 }),
      ]);
      setData({
        stats: statsRes.data,
        todayScans: todayRes.data.total_scans,
        totalWorkers: workersRes.total,
        recentLogs: recentRes.data,
      });
    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="p-8"><ErrorState description={error} onRetry={load} /></div>;
  }

  const { stats, todayScans, totalWorkers, recentLogs } = data;
  const todayFails = recentLogs.filter(l => l.scanned_at.startsWith(new Date().toISOString().split('T')[0]) && l.result === 'FAIL').length;
  const topMissed = stats.most_missed_ppe[0];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">PPE Inspection Station overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Active Workers" value={totalWorkers} sub="Registered in system" accent="default" />
        <StatCard icon={ScanLine} label="Today's Scans" value={todayScans} sub="Since midnight" accent="success" />
        <StatCard icon={ShieldCheck} label="Compliance Rate" value={`${stats.compliance_rate}%`} sub={`${stats.passed} of ${stats.total_scans} passed`} accent="success" />
        <StatCard icon={AlertTriangle} label="Failed Today" value={todayFails} sub={topMissed ? `Top miss: ${topMissed.display_name}` : 'No failures'} accent="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/logs')} className="gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentLogs.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No activity yet" description="Scan events will appear here." />
            ) : (
              <div className="divide-y">
                {recentLogs.map(log => (
                  <div key={log.id} className="flex items-center gap-3 px-6 py-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                      log.result === 'PASS' ? 'bg-success/10 text-success' :
                      log.result === 'FAIL' ? 'bg-destructive/10 text-destructive' :
                      'bg-warning/10 text-warning'
                    }`}>
                      {log.worker_name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{log.worker_name || 'Unknown Card'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.scanned_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                        {log.role && ` · ${log.role}`}
                      </p>
                    </div>
                    <ResultBadge result={log.result} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Most Missed PPE Items</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.most_missed_ppe.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="No missed items" description="All inspections passed!" />
            ) : (
              <div className="space-y-4">
                {stats.most_missed_ppe.map((item, i) => {
                  const max = stats.most_missed_ppe[0]?.miss_count || 1;
                  const pct = Math.round((item.miss_count / max) * 100);
                  return (
                    <div key={item.item_key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium">{item.display_name}</span>
                        <span className="text-sm text-muted-foreground">{item.miss_count} times</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${i === 0 ? 'bg-destructive' : 'bg-warning'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
