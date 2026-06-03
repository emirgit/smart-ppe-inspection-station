import { useEffect, useState, useRef } from 'react'
import {
  Plus, Pencil, UserX, UserCheck, Trash2,
  Search, AlertTriangle, Camera, X, BarChart3,
  CheckCircle2, XCircle, Activity, Clock, ShieldAlert,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { api, resolveAssetUrl } from '@/services/api'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'

// ── Reactivate Dialog ─────────────────────────────────────
function ReactivateDialog({ open, onOpenChange, worker, onSaved }: any) {
  const [rfid, setRfid] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) setRfid('') }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rfid.trim()) { toast.error('RFID kart UID gerekli.'); return }
    setSaving(true)
    try {
      await api.updateWorker(worker.id, { rfid_card_uid: rfid.trim().toUpperCase() })
      toast.success(`${worker.full_name} tekrar aktif edildi.`)
      onSaved()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Çalışanı Tekrar Aktif Et</DialogTitle>
          <DialogDescription>
            <strong>{worker?.full_name}</strong> deaktif edildiğinde RFID kartı serbest bırakıldı.
            Tekrar aktif etmek için yeni bir RFID kart UID girin.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Yeni RFID Kart UID</Label>
            <Input
              value={rfid}
              onChange={e => setRfid(e.target.value.toUpperCase())}
              placeholder="A1B2C3D4"
              maxLength={20}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Kartı okutun veya manuel girin.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Aktif ediliyor...' : 'Aktif Et'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function cacheBustedPhotoUrl(photoUrl?: string | null, timestamp?: string | null) {
  const resolved = resolveAssetUrl(photoUrl)
  if (!resolved) return ''
  const marker = timestamp ? new Date(timestamp).getTime() : Date.now()
  return `${resolved}${resolved.includes('?') ? '&' : '?'}t=${marker}`
}

// ── Worker Dialog ─────────────────────────────────────────
function WorkerDialog({ open, onOpenChange, worker, roles, onSaved }: any) {
  const isEdit = !!worker
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [scanOpenedAt, setScanOpenedAt] = useState<number | null>(null)
  const [latestScan, setLatestScan] = useState<{ rfid: string; timestamp: string } | null>(null)

  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } = useForm({
    defaultValues: { full_name: '', rfid_card_uid: '', role_id: '' }
  })
  const roleId = watch('role_id')

  useEffect(() => {
    if (open) {
      if (!isEdit) {
        const openedAt = Date.now()
        setScanOpenedAt(openedAt)
        setLatestScan(null)
      }
      reset({
        full_name: worker?.full_name || '',
        rfid_card_uid: worker?.rfid_card_uid || '',
        role_id: worker?.role_id ? String(worker.role_id) : '',
      })
      setPhotoFile(null)
      setPhotoPreview(null)
      setRemovePhoto(false)
    }
  }, [open, worker])

  useEffect(() => {
    if (!open || isEdit || !scanOpenedAt) return

    let active = true
    const poll = async () => {
      try {
        const res = await api.scanRfid()
        const scan = res?.data
        if (!active || !scan?.rfid || !scan?.timestamp) return
        const scanTime = new Date(scan.timestamp).getTime()
        if (Number.isNaN(scanTime) || scanTime <= scanOpenedAt) return
        setLatestScan({ rfid: scan.rfid, timestamp: scan.timestamp })
      } catch {
        // ignore polling errors
      }
    }

    poll()
    const tid = setInterval(poll, 2000)
    return () => {
      active = false
      clearInterval(tid)
    }
  }, [open, isEdit, scanOpenedAt])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Fotoğraf max 5MB olabilir.'); return }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setRemovePhoto(false)
  }

  async function onSubmit(data: any) {
    try {
      const body = { ...data, role_id: Number(data.role_id) }
      let saved: any
      if (isEdit) {
        saved = await api.updateWorker(worker.id, body)
        if (removePhoto && worker.photo_url) {
          await api.deleteWorkerPhoto(worker.id).catch(() => {})
        } else if (photoFile) {
          await api.uploadWorkerPhoto(worker.id, photoFile)
        }
      } else {
        saved = await api.createWorker(body)
        if (photoFile && saved.data?.id) {
          await api.uploadWorkerPhoto(saved.data.id, photoFile)
        }
      }
      toast.success(isEdit ? 'Çalışan güncellendi.' : 'Çalışan eklendi.')
      onOpenChange(false)
      await onSaved()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const currentPhoto = photoPreview || (removePhoto ? null : worker?.photo_url)
  const initials = (worker?.full_name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Çalışanı Düzenle' : 'Yeni Çalışan Ekle'}</DialogTitle>
          <DialogDescription>Çalışan bilgilerini doldurun.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16">
                <AvatarImage src={resolveAssetUrl(currentPhoto) || ''} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              {currentPhoto && (
                <button
                  type="button"
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null); setRemovePhoto(true) }}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Profil Fotoğrafı</p>
              <p className="text-xs text-muted-foreground">JPEG, PNG veya WebP, max 5MB</p>
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Camera className="h-3.5 w-3.5 mr-1" />
                {currentPhoto ? 'Değiştir' : 'Yükle'}
              </Button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Ad Soyad</Label>
            <Input {...register('full_name', { required: true })} placeholder="Ahmet Yılmaz" />
          </div>
          <div className="space-y-1.5">
            <Label>RFID Kart UID</Label>
            <div className="flex items-center gap-2">
              <Input {...register('rfid_card_uid')} placeholder="A1B2C3D4" maxLength={20} />
              {latestScan && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setValue('rfid_card_uid', latestScan.rfid)}
                >
                  RFID Al
                </Button>
              )}
            </div>
            {isEdit && <p className="text-xs text-muted-foreground">Boş bırakılırsa RFID değişmez.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <Select value={roleId} onValueChange={v => setValue('role_id', v)}>
              <SelectTrigger><SelectValue placeholder="Rol seçin" /></SelectTrigger>
              <SelectContent>
                {roles.map((r: any) => (
                  <SelectItem key={r.id} value={String(r.id)}>{r.role_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Digital Twin Dialog ───────────────────────────────────
function DigitalTwinDialog({ open, onOpenChange, workerId }: { open: boolean; onOpenChange: (v: boolean) => void; workerId: number | null }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    if (!open || !workerId) return
    setLoading(true)
    setError(null)
    setData(null)
    api.getWorkerDigitalTwin(workerId)
      .then((res: any) => setData(res.data))
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false))
  }, [open, workerId])

  const stats = data?.stats
  const worker = data?.worker
  const logs = data?.last_10_entry_logs || []

  // SVG ring for compliance rate
  const complianceRate = stats?.compliance_rate ?? 0
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (complianceRate / 100) * circumference
  const rateColor = complianceRate >= 80 ? 'text-emerald-500' : complianceRate >= 50 ? 'text-amber-500' : 'text-red-500'
  const rateColorStroke = complianceRate >= 80 ? 'stroke-emerald-500' : complianceRate >= 50 ? 'stroke-amber-500' : 'stroke-red-500'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            {loading ? 'Yükleniyor...' : worker ? `${worker.full_name} — Dijital İkiz` : 'Dijital İkiz'}
          </DialogTitle>
          <DialogDescription>
            Çalışanın geçiş istatistikleri ve son tarama kayıtları.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="space-y-4 py-4">
            <div className="flex gap-4">
              <Skeleton className="h-36 w-36 rounded-full" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
            </div>
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-4 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}

        {data && !loading && (
          <div className="flex-1 -mx-6 px-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
            <div className="space-y-5 pb-2">
              {/* ── Stats Overview ── */}
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                {/* Compliance Ring */}
                <div className="relative flex-shrink-0">
                  <svg width="140" height="140" className="-rotate-90">
                    <circle cx="70" cy="70" r={radius} fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="10" />
                    <circle cx="70" cy="70" r={radius} fill="none" className={rateColorStroke} strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                      style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-bold ${rateColor}`}>{complianceRate}%</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Uyum</span>
                  </div>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-3 gap-3 flex-1 w-full">
                  <div className="rounded-xl border bg-card p-3 text-center space-y-1">
                    <Activity className="h-4 w-4 mx-auto text-muted-foreground" />
                    <p className="text-2xl font-bold">{stats.total_scans}</p>
                    <p className="text-[11px] text-muted-foreground">Toplam Tarama</p>
                  </div>
                  <div className="rounded-xl border bg-card p-3 text-center space-y-1">
                    <CheckCircle2 className="h-4 w-4 mx-auto text-emerald-500" />
                    <p className="text-2xl font-bold text-emerald-600">{stats.passed}</p>
                    <p className="text-[11px] text-muted-foreground">Geçti</p>
                  </div>
                  <div className="rounded-xl border bg-card p-3 text-center space-y-1">
                    <XCircle className="h-4 w-4 mx-auto text-red-500" />
                    <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                    <p className="text-[11px] text-muted-foreground">Kaldı</p>
                  </div>
                </div>
              </div>

              {/* ── Worker Info Row ── */}
              <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={cacheBustedPhotoUrl(worker.photo_url, worker.updated_at || worker.created_at)} />
                  <AvatarFallback className="text-xs">
                    {worker.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{worker.full_name}</p>
                  <p className="text-xs text-muted-foreground">{worker.role_name}</p>
                </div>
                {worker.rfid_card_uid && (
                  <code className="text-xs bg-muted px-2 py-0.5 rounded">{worker.rfid_card_uid}</code>
                )}
                <Badge variant={worker.is_active ? 'default' : 'secondary'}>
                  {worker.is_active ? 'Aktif' : 'Pasif'}
                </Badge>
              </div>

              {/* ── İSG Training Warning ── */}
              {complianceRate < 25 && (
                <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                  <ShieldAlert className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">İSG Eğitimi Öneriliyor</p>
                    <p className="text-xs text-amber-600/80 dark:text-amber-400/70">
                      Bu çalışanın uyum oranı %{complianceRate} ile kritik seviyenin altında. İş Sağlığı ve Güvenliği eğitimi planlanması önerilir.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Last 10 Entry Logs ── */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Son 10 Geçiş Kaydı
                </h3>
                {logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Henüz geçiş kaydı yok.</p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Tarih</TableHead>
                          <TableHead>Sonuç</TableHead>
                          <TableHead>Süre</TableHead>
                          <TableHead>Eksik KKD</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log: any, idx: number) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="text-xs">
                              {new Date(log.scanned_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                            <TableCell>
                              {log.result === 'PASS' ? (
                                <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-[11px] px-1.5 py-0">
                                  <CheckCircle2 className="h-3 w-3 mr-0.5" /> PASS
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[11px] px-1.5 py-0">
                                  <XCircle className="h-3 w-3 mr-0.5" /> FAIL
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {log.inspection_time_ms != null ? `${(log.inspection_time_ms / 1000).toFixed(1)}s` : '—'}
                            </TableCell>
                            <TableCell>
                              {log.missing_ppe && log.missing_ppe.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {log.missing_ppe.map((item: any) => (
                                    <Badge key={item.item_key} variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-600">
                                      <ShieldAlert className="h-2.5 w-2.5 mr-0.5" />
                                      {item.display_name}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ─────────────────────────────────────────────
export function Workers() {
  const [workers, setWorkers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterActive, setFilterActive] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editWorker, setEditWorker] = useState<any>(null)
  const [reactivateTarget, setReactivateTarget] = useState<any>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<any>(null)
  const [hardDeleteTarget, setHardDeleteTarget] = useState<any>(null)
  const [digitalTwinTarget, setDigitalTwinTarget] = useState<number | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const [wr, rr] = await Promise.all([api.listWorkers(), api.listRoles()])
      setWorkers(wr.data); setRoles(rr.data)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleDeactivate() {
    if (!deactivateTarget) return
    try {
      await api.softDeleteWorker(deactivateTarget.id)
      toast.success(`${deactivateTarget.full_name} deaktif edildi.`)
      setDeactivateTarget(null); load()
    } catch (e: any) { toast.error(e.message) }
  }

  async function handleHardDelete() {
    if (!hardDeleteTarget) return
    try {
      await api.hardDeleteWorker(hardDeleteTarget.id)
      toast.success(`${hardDeleteTarget.full_name} kalıcı olarak silindi.`)
      setHardDeleteTarget(null); load()
    } catch (e: any) { toast.error(e.message) }
  }

  const filtered = workers.filter((w: any) => {
    if (search && !w.full_name.toLowerCase().includes(search.toLowerCase()) &&
      !(w.rfid_card_uid || '').toLowerCase().includes(search.toLowerCase())) return false
    if (filterRole !== 'all' && w.role_id !== Number(filterRole)) return false
    if (filterActive === 'active' && !w.is_active) return false
    if (filterActive === 'inactive' && w.is_active) return false
    return true
  })

  return (
    <>
      <Header fixed>
        <div className="flex items-center gap-2 ms-auto">
          <ThemeSwitch />
        </div>
      </Header>
      <Main>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Çalışanlar</h1>
          <Button onClick={() => { setEditWorker(null); setDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Yeni Çalışan
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 mb-4 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4" /> {error}
            <Button size="sm" variant="ghost" className="ms-auto" onClick={load}>Tekrar dene</Button>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="İsim veya RFID ara..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Roller</SelectItem>
              {roles.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.role_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterActive} onValueChange={setFilterActive}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="inactive">Pasif</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>RFID</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Kayıt</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
                : filtered.length === 0
                  ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{search ? 'Arama sonucu bulunamadı.' : 'Henüz çalışan yok.'}</TableCell></TableRow>
                  : filtered.map((w: any) => (
                    <TableRow key={w.id} className={!w.is_active ? 'opacity-60' : ''}>
                      <TableCell>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={cacheBustedPhotoUrl(w.photo_url, w.updated_at || w.created_at)} />
                          <AvatarFallback className="text-xs">
                            {w.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{w.full_name}</TableCell>
                      <TableCell>
                        {w.rfid_card_uid
                          ? <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{w.rfid_card_uid}</code>
                          : <span className="text-xs text-muted-foreground italic">atanmamış</span>
                        }
                      </TableCell>
                      <TableCell className="text-sm">{w.role_name}</TableCell>
                      <TableCell>
                        <Badge variant={w.is_active ? 'default' : 'secondary'}>
                          {w.is_active ? 'Aktif' : 'Pasif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(w.created_at).toLocaleDateString('tr-TR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="İstatistikler"
                            onClick={() => setDigitalTwinTarget(w.id)}>
                            <BarChart3 className="h-3.5 w-3.5" />
                          </Button>
                          {w.is_active && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Düzenle"
                              onClick={() => { setEditWorker(w); setDialogOpen(true) }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {w.is_active
                            ? <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Deaktif Et"
                                onClick={() => setDeactivateTarget(w)}>
                                <UserX className="h-3.5 w-3.5" />
                              </Button>
                            : <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-600" title="Tekrar Aktif Et"
                                onClick={() => setReactivateTarget(w)}>
                                <UserCheck className="h-3.5 w-3.5" />
                              </Button>
                          }
                          {!w.is_active && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Kalıcı Sil"
                              onClick={() => setHardDeleteTarget(w)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
              }
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{filtered.length} çalışan</p>

        <WorkerDialog open={dialogOpen} onOpenChange={setDialogOpen} worker={editWorker} roles={roles} onSaved={load} />

        <DigitalTwinDialog open={digitalTwinTarget !== null} onOpenChange={(v) => !v && setDigitalTwinTarget(null)} workerId={digitalTwinTarget} />

        <ReactivateDialog open={!!reactivateTarget} onOpenChange={(v: boolean) => !v && setReactivateTarget(null)} worker={reactivateTarget} onSaved={load} />

        <AlertDialog open={!!deactivateTarget} onOpenChange={v => !v && setDeactivateTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Çalışanı deaktif et?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{deactivateTarget?.full_name}</strong> sisteme giriş yapamaz hale gelecek. RFID kartı serbest kalır, başka bir çalışana atanabilir.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>İptal</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeactivate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Deaktif Et</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!hardDeleteTarget} onOpenChange={v => !v && setHardDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Kalıcı olarak sil?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{hardDeleteTarget?.full_name}</strong> veritabanından tamamen silinecek. Bu işlem geri alınamaz.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>İptal</AlertDialogCancel>
              <AlertDialogAction onClick={handleHardDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Kalıcı Sil</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Main>
    </>
  )
}
