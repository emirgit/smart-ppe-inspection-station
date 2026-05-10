import { useEffect, useState } from 'react'
import { Plus, Pencil, UserX, Search, AlertTriangle } from 'lucide-react'
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
import { api } from '@/services/api'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

function WorkerDialog({ open, onOpenChange, worker, roles, onSaved }: any) {
  const isEdit = !!worker
  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } = useForm({
    defaultValues: { full_name: '', rfid_card_uid: '', role_id: '' }
  })

  useEffect(() => {
    if (open) reset({ full_name: worker?.full_name || '', rfid_card_uid: worker?.rfid_card_uid || '', role_id: worker?.role_id ? String(worker.role_id) : '' })
  }, [open, worker])

  const roleId = watch('role_id')

  async function onSubmit(data: any) {
    try {
      const body = { ...data, role_id: Number(data.role_id) }
      if (isEdit) await api.updateWorker(worker.id, body)
      else await api.createWorker(body)
      toast.success(isEdit ? 'Çalışan güncellendi.' : 'Çalışan eklendi.')
      onSaved(); onOpenChange(false)
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Çalışanı Düzenle' : 'Yeni Çalışan Ekle'}</DialogTitle>
          <DialogDescription>Çalışan bilgilerini doldurun.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Ad Soyad</Label>
            <Input {...register('full_name', { required: true })} placeholder="Ahmet Yılmaz" />
          </div>
          <div className="space-y-1.5">
            <Label>RFID Kart UID</Label>
            <Input {...register('rfid_card_uid', { required: true })} placeholder="A1B2C3D4" maxLength={20} />
            <p className="text-xs text-muted-foreground">Kartı okutun veya manuel girin</p>
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <Select value={roleId} onValueChange={v => setValue('role_id', v)}>
              <SelectTrigger><SelectValue placeholder="Rol seçin" /></SelectTrigger>
              <SelectContent>
                {roles.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.role_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

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
  const [deactivateTarget, setDeactivateTarget] = useState<any>(null)

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

  const filtered = workers.filter((w: any) => {
    if (search && !w.full_name.toLowerCase().includes(search.toLowerCase()) && !w.rfid_card_uid.toLowerCase().includes(search.toLowerCase())) return false
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
          <ProfileDropdown />
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
                <TableHead>Ad Soyad</TableHead>
                <TableHead>RFID</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Kayıt Tarihi</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
                : filtered.length === 0
                  ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{search ? 'Arama sonucu bulunamadı.' : 'Henüz çalışan yok.'}</TableCell></TableRow>
                  : filtered.map((w: any) => (
                    <TableRow key={w.id} className={!w.is_active ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">{w.full_name}</TableCell>
                      <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{w.rfid_card_uid}</code></TableCell>
                      <TableCell className="text-sm">{w.role_name}</TableCell>
                      <TableCell><Badge variant={w.is_active ? 'default' : 'secondary'}>{w.is_active ? 'Aktif' : 'Pasif'}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleDateString('tr-TR')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditWorker(w); setDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                          {w.is_active && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeactivateTarget(w)}><UserX className="h-3.5 w-3.5" /></Button>}
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

        <AlertDialog open={!!deactivateTarget} onOpenChange={v => !v && setDeactivateTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Çalışanı deaktif et?</AlertDialogTitle>
              <AlertDialogDescription><strong>{deactivateTarget?.full_name}</strong> sisteme giriş yapamaz hale gelecek.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>İptal</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeactivate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Deaktif Et</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Main>
    </>
  )
}
