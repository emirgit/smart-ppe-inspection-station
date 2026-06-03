import { useEffect, useState } from 'react'
import { Users, CheckCircle, ScanLine, TrendingDown, AlertTriangle, RefreshCw } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/services/api'

function StatCard({ title, value, subtitle, icon: Icon, loading }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-24" /> : (
          <>
            <div className="text-2xl font-bold">{value ?? '—'}</div>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function Dashboard() {
  const [stats, setStats] = useState<any>(null)
  const [workers, setWorkers] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const [sr, wr, lr] = await Promise.all([
        api.getEntryLogStats(),
        api.listWorkers(),
        api.listEntryLogs({ limit: 6 }),
      ])
      setStats(sr.data); setWorkers(wr.data); setLogs(lr.data)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const activeWorkers = workers.filter((w: any) => w.is_active).length

  return (
    <>
      <Header fixed>
        <div className="flex items-center gap-2 ms-auto">
          <ThemeSwitch />
        </div>
      </Header>
      <Main>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Yenile
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 mb-4 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4" /> {error}
            <Button size="sm" variant="ghost" className="ms-auto" onClick={load}>Tekrar dene</Button>
          </div>
        )}

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard loading={loading} title="Aktif Çalışan"    value={activeWorkers}                    subtitle="Kayıtlı toplam"       icon={Users} />
          <StatCard loading={loading} title="Uyum Oranı"       value={stats ? `%${stats.compliance_rate}` : undefined} subtitle="Geçen/toplam" icon={CheckCircle} />
          <StatCard loading={loading} title="Toplam Tarama"    value={stats?.total_scans}               subtitle="Tüm zamanlar"        icon={ScanLine} />
          <StatCard loading={loading} title="Başarısız Kontrol" value={stats?.failed}                   subtitle="PPE eksik girişler"  icon={TrendingDown} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Son Taramalar</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
                : logs.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-4">Henüz tarama yok</p>
                  : logs.map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between gap-2 py-1 border-b last:border-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{log.worker_name || 'Bilinmeyen Kart'}</p>
                        <p className="text-xs text-muted-foreground">{new Date(log.scanned_at).toLocaleString('tr-TR')}</p>
                      </div>
                      <Badge variant={log.result === 'PASS' ? 'default' : log.result === 'FAIL' ? 'destructive' : 'secondary'} className="shrink-0">
                        {log.result === 'PASS' ? 'Geçti' : log.result === 'FAIL' ? 'Başarısız' : 'Bilinmiyor'}
                      </Badge>
                    </div>
                  ))
              }
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">En Çok Eksik PPE</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
                : !stats?.most_missed_ppe?.length
                  ? <p className="text-sm text-muted-foreground text-center py-4">Veri yok</p>
                  : stats.most_missed_ppe.map((item: any) => (
                    <div key={item.item_key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.display_name}</span>
                        <span className="text-muted-foreground text-xs">{item.miss_count}x</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-destructive rounded-full" style={{ width: `${(item.miss_count / (stats.most_missed_ppe[0]?.miss_count || 1)) * 100}%` }} />
                      </div>
                    </div>
                  ))
              }
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
