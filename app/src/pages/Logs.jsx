import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, ClipboardList, RefreshCw } from 'lucide-react';
import { api } from '@/services/api';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResultBadge } from '@/components/ui/result-badge';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';

const POLL_INTERVAL_MS = 10000;

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('ALL');
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const res = await api.listEntryLogs({
        result: resultFilter === 'ALL' ? undefined : resultFilter,
        limit: 100,
      });
      setLogs(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [resultFilter]);

  // Initial load + when filter changes
  useEffect(() => { load(); }, [load]);

  // Polling
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      load(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  // Frontend search filter
  const filtered = logs.filter(log => {
    if (!search) return true;
    const s = search.toLowerCase();
    return log.worker_name?.toLowerCase().includes(s) || log.rfid_uid_scanned?.toLowerCase().includes(s);
  });

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) return <div className="p-8"><ErrorState description={error} onRetry={load} /></div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Entry Logs</h1>
          <p className="text-sm text-muted-foreground">
            History of inspection events
            {lastUpdated && (
              <span className="ml-2 text-xs">
                · Updated {lastUpdated.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load()} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or RFID..."
            className="pl-9"
          />
        </div>
        <Select value={resultFilter} onValueChange={setResultFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Results</SelectItem>
            <SelectItem value="PASS">Pass Only</SelectItem>
            <SelectItem value="FAIL">Fail Only</SelectItem>
            <SelectItem value="UNKNOWN_CARD">Unknown Cards</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="ml-auto">
          {filtered.length} log{filtered.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No logs found"
            description={search || resultFilter !== 'ALL'
              ? "Try adjusting your filters."
              : "Inspection events will appear here."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Worker</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Missing Items</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {new Date(log.scanned_at).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell>
                    {log.worker_name ? (
                      <span className="font-medium">{log.worker_name}</span>
                    ) : (
                      <span className="text-muted-foreground italic">Unknown</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{log.role || '—'}</TableCell>
                  <TableCell><ResultBadge result={log.result} /></TableCell>
                  <TableCell>
                    {log.missing_ppe.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {log.missing_ppe.map(item => (
                          <Badge key={item.item_key} variant="outline" className="border-destructive/30 text-destructive text-xs">
                            {item.display_name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.inspection_time_ms ? `${(log.inspection_time_ms / 1000).toFixed(1)}s` : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
