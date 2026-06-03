import { useEffect, useState, useRef } from 'react'
import {
  Plus, Pencil, UserX, UserCheck, Trash2,
  Search, AlertTriangle, Camera, X,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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

  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } = useForm({
    defaultValues: { full_name: '', rfid_card_uid: '', role_id: '' }
  })
  const roleId = watch('role_id')

  useEffect(() => {
    if (open) {
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
            <Input {...register('rfid_card_uid')} placeholder="A1B2C3D4" maxLength={20} />
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
