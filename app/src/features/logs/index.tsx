import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, RefreshCw, Search } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, resolveAssetUrl } from '@/services/api'

const RESULT_LABELS: Record<string, string> = {
  PASS: 'Geçti',
  FAIL: 'Başarısız',
  UNKNOWN_CARD: 'Bilinmeyen Kart',
}

function resultVariant(result: string) {
  if (result === 'PASS') return 'default'
  if (result === 'FAIL') return 'destructive'
  return 'secondary'
}

function formatDuration(ms?: number | null) {
  if (!ms) return '-'
  return `${(ms / 1000).toFixed(1)} sn`
}

export function Logs() {
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [result, setResult] = useState('all')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.listEntryLogs({
        limit: 100,
        result: result === 'all' ? undefined : result,
      })
      setLogs(res.data || [])
      setTotal(res.total ?? res.data?.length ?? 0)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [result])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return logs
    return logs.filter((log) => {
      const worker = log.worker_name || 'Bilinmeyen Kart'
      return worker.toLowerCase().includes(term) || log.rfid_uid_scanned?.toLowerCase().includes(term)
    })
  }, [logs, search])

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>
      <Main>
        <div className='mb-4 flex items-center justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Kayıtlar</h1>
            <p className='text-sm text-muted-foreground'>{total} giriş kaydı</p>
          </div>
          <Button variant='outline' size='sm' onClick={load}>
            <RefreshCw className='mr-1 h-3.5 w-3.5' />
            Yenile
          </Button>
        </div>

        {error && (
          <div className='mb-4 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive'>
            <AlertTriangle className='h-4 w-4' />
            {error}
            <Button size='sm' variant='ghost' className='ms-auto' onClick={load}>
              Tekrar dene
            </Button>
          </div>
        )}

        <div className='mb-4 flex flex-col gap-3 sm:flex-row sm:items-center'>
          <div className='relative flex-1'>
            <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='Çalışan veya RFID ara...'
              className='pl-8'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={result} onValueChange={setResult}>
            <SelectTrigger className='w-full sm:w-44'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Tüm Sonuçlar</SelectItem>
              <SelectItem value='PASS'>Geçti</SelectItem>
              <SelectItem value='FAIL'>Başarısız</SelectItem>
              <SelectItem value='UNKNOWN_CARD'>Bilinmeyen Kart</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Çalışan</TableHead>
                <TableHead>RFID</TableHead>
                <TableHead>Sonuç</TableHead>
                <TableHead>Eksik PPE</TableHead>
                <TableHead>Süre</TableHead>
                <TableHead>Görüntü</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className='h-4 w-full' />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : filtered.length === 0
                  ? (
                      <TableRow>
                        <TableCell colSpan={7} className='py-8 text-center text-muted-foreground'>
                          Kayıt bulunamadı.
                        </TableCell>
                      </TableRow>
                    )
                  : filtered.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className='whitespace-nowrap text-xs text-muted-foreground'>
                          {new Date(log.scanned_at).toLocaleString('tr-TR')}
                        </TableCell>
                        <TableCell className='font-medium'>
                          {log.worker_name || 'Bilinmeyen Kart'}
                        </TableCell>
                        <TableCell>
                          <code className='rounded bg-muted px-1.5 py-0.5 text-xs'>
                            {log.rfid_uid_scanned}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant={resultVariant(log.result)}>
                            {RESULT_LABELS[log.result] || log.result}
                          </Badge>
                        </TableCell>
                        <TableCell className='max-w-64'>
                          {log.missing_ppe?.length
                            ? (
                                <div className='flex flex-wrap gap-1'>
                                  {log.missing_ppe.map((item: any) => (
                                    <Badge key={item.item_key} variant='outline'>
                                      {item.display_name}
                                    </Badge>
                                  ))}
                                </div>
                              )
                            : <span className='text-sm text-muted-foreground'>Yok</span>
                          }
                        </TableCell>
                        <TableCell className='text-sm'>{formatDuration(log.inspection_time_ms)}</TableCell>
                        <TableCell>
                          {log.camera_snapshot_url
                            ? (
                                <a
                                  href={resolveAssetUrl(log.camera_snapshot_url)}
                                  target='_blank'
                                  rel='noreferrer'
                                  className='text-sm text-primary underline-offset-4 hover:underline'
                                >
                                  Aç
                                </a>
                              )
                            : <span className='text-sm text-muted-foreground'>-</span>
                          }
                        </TableCell>
                      </TableRow>
                    ))
              }
            </TableBody>
          </Table>
        </div>
        <p className='mt-2 text-xs text-muted-foreground'>{filtered.length} kayıt gösteriliyor</p>
      </Main>
    </>
  )
}
