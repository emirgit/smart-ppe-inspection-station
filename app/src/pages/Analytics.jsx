import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorState } from '@/components/error-state';
import { EmptyState } from '@/components/empty-state';

const DATE_RANGES = {
  '7d': { label: 'Last 7 days', days: 7 },
  '30d': { label: 'Last 30 days', days: 30 },
  '90d': { label: 'Last 90 days', days: 90 },
  'all': { label: 'All time', days: null },
};

const COLORS = {
  pass: 'hsl(var(--success))',
  fail: 'hsl(var(--destructive))',
  unknown: 'hsl(var(--warning))',
  primary: 'hsl(var(--primary))',
};

function getDateRange(key) {
  if (key === 'all') return {};
  const days = DATE_RANGES[key].days;
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    start_date: start.toISOString().split('T')[0],
    end_date: end.toISOString().split('T')[0],
  };
}

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState('7d');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getEntryLogStats(getDateRange(range));
      setStats(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-8 w-48" /><div className="grid grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-72" />)}</div></div>;
  }

  if (error) return <div className="p-8"><ErrorState description={error} onRetry={load} /></div>;

  const pieData = [
    { name: 'Pass', value: stats.passed, color: COLORS.pass },
    { name: 'Fail', value: stats.failed, color: COLORS.fail },
    { name: 'Unknown', value: stats.unknown_cards, color: COLORS.unknown },
  ].filter(d => d.value > 0);

  const noData = stats.total_scans === 0;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">Compliance trends and inspection statistics</p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(DATE_RANGES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {noData ? (
        <Card>
          <EmptyState icon={BarChart3} title="No data for this period" description="Try a wider date range." />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Compliance Rate Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={stats.daily_data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6 }} />
                  <Line type="monotone" dataKey="rate" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 4 }} name="Compliance %" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Daily Pass vs Fail</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.daily_data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="pass" fill={COLORS.pass} name="Pass" />
                  <Bar dataKey="fail" fill={COLORS.fail} name="Fail" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Result Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value"
                       label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Most Missed PPE Items</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.most_missed_ppe.length === 0 ? (
                <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No missed items in this period.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={stats.most_missed_ppe} layout="vertical" margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis type="category" dataKey="display_name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={110} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6 }} />
                    <Bar dataKey="miss_count" fill={COLORS.fail} name="Times Missed" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
