import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/services/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts'

const RANGES = [
  { label: 'Son 7 gün',  days: 7 },
  { label: 'Son 30 gün', days: 30 },
  { label: 'Son 90 gün', days: 90 },
]

function getRange(days: number) {
  const end = new Date(), start = new Date()
  start.setDate(start.getDate() - days)
  return {
    start_date: start.toISOString().split('T')[0],
    end_date: end.toISOString().split('T')[0],
  }
}

// ── Custom Tooltip — dark mode uyumlu ────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-md text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color }} className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: entry.color }}
          />
          {entry.name}: <span className="font-medium text-foreground">{entry.value}{entry.unit || ''}</span>
        </p>
      ))}
    </div>
  )
}

function CustomLineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-md text-xs">
      <p className="font-medium text-foreground mb-1">Tarih: {label}</p>
      <p className="text-foreground">
        Uyum: <span className="font-medium">%{payload[0]?.value}</span>
      </p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────
export function Analytics() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rangeDays, setRangeDays] = useState(30)

  async function load(days: number) {
    setLoading(true); setError(null)
    try {
      const res = await api.getEntryLogStats(getRange(days))
      setStats(res.data)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load(rangeDays) }, [rangeDays])

  return (
    <>
      <Header fixed>
        <div className="flex items-center gap-2 ms-auto">
          <ThemeSwitch /><ProfileDropdown />
        </div>
      </Header>
      <Main>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Analitik</h1>
          <div className="flex gap-2">
            {RANGES.map(r => (
              <Button
                key={r.days}
                size="sm"
                variant={rangeDays === r.days ? 'default' : 'outline'}
                onClick={() => setRangeDays(r.days)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 mb-4 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4" /> {error}
            <Button size="sm" variant="ghost" className="ms-auto" onClick={() => load(rangeDays)}>
              Tekrar dene
            </Button>
          </div>
        )}

        {/* Özet kartlar */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-6">
          {[
            { label: 'Toplam Tarama', value: stats?.total_scans },
            { label: 'Geçti',         value: stats?.passed },
            { label: 'Başarısız',     value: stats?.failed },
            { label: 'Uyum Oranı',   value: stats ? `%${stats.compliance_rate}` : undefined },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground font-normal">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                {loading
                  ? <Skeleton className="h-7 w-16" />
                  : <p className="text-xl font-bold text-foreground">{value ?? '—'}</p>
                }
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-6">
          {/* Günlük uyum oranı */}
          <Card>
            <CardHeader><CardTitle className="text-base">Günlük Uyum Oranı</CardTitle></CardHeader>
            <CardContent>
              {loading
                ? <Skeleton className="h-48 w-full" />
                : !stats?.daily_data?.length
                  ? <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Veri yok</div>
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={stats.daily_data}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          tickFormatter={(v: string) => v.slice(5)}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                          tickLine={{ stroke: 'hsl(var(--border))' }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          unit="%"
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                          tickLine={{ stroke: 'hsl(var(--border))' }}
                        />
                        <Tooltip content={<CustomLineTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="rate"
                          name="Uyum"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )
              }
            </CardContent>
          </Card>

          {/* Günlük geçti/başarısız */}
          <Card>
            <CardHeader><CardTitle className="text-base">Günlük Geçti / Başarısız</CardTitle></CardHeader>
            <CardContent>
              {loading
                ? <Skeleton className="h-48 w-full" />
                : !stats?.daily_data?.length
                  ? <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Veri yok</div>
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={stats.daily_data}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          tickFormatter={(v: string) => v.slice(5)}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                          tickLine={{ stroke: 'hsl(var(--border))' }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                          tickLine={{ stroke: 'hsl(var(--border))' }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                          formatter={(v: string) => (
                            <span className="text-xs text-foreground">
                              {v === 'pass' ? 'Geçti' : 'Başarısız'}
                            </span>
                          )}
                        />
                        <Bar dataKey="pass" name="pass" fill="#22c55e" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="fail" name="fail" fill="#ef4444" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
              }
            </CardContent>
          </Card>
        </div>

        {/* En çok eksik PPE */}
        <Card>
          <CardHeader><CardTitle className="text-base">En Çok Eksik PPE</CardTitle></CardHeader>
          <CardContent>
            {loading
              ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              : !stats?.most_missed_ppe?.length
                ? <p className="text-sm text-muted-foreground text-center py-4">Bu dönemde eksik PPE kaydı yok</p>
                : (
                  <div className="space-y-3">
                    {stats.most_missed_ppe.map((item: any, i: number) => (
                      <div key={item.item_key} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-foreground">{item.display_name}</p>
                            <Badge variant="destructive" className="text-xs">{item.miss_count}x</Badge>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-destructive rounded-full"
                              style={{ width: `${(item.miss_count / (stats.most_missed_ppe[0]?.miss_count || 1)) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
            }
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
