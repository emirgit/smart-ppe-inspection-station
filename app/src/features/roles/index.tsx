import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { api } from '@/services/api'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

function RoleCard({ role, ppeItems, onEdit, onDelete, onPpeChange }: any) {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<number[]>(role.required_ppe || [])
  useEffect(() => { setSelected(role.required_ppe || []) }, [role])

  async function save() {
    setSaving(true)
    try {
      await api.replaceRolePpe(role.id, { ppe_item_ids: selected })
      toast.success('PPE gereksinimleri güncellendi.')
      onPpeChange()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const hasChanges = JSON.stringify([...selected].sort()) !== JSON.stringify([...(role.required_ppe || [])].sort())

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">{role.role_name}</CardTitle>
            {role.description && <p className="text-xs text-muted-foreground mt-1">{role.description}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="secondary">{role.worker_count ?? 0} çalışan</Badge>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(role)}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(role)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {(role.ppe_items || []).map((p: any) => <Badge key={p.id} variant="outline" className="text-xs">{p.display_name}</Badge>)}
          {!(role.ppe_items?.length) && <span className="text-xs text-muted-foreground">PPE gereksinimi yok</span>}
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-3">
        <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          PPE Gereksinimlerini Düzenle
        </button>
        {expanded && (
          <div className="mt-3 space-y-2">
            {ppeItems.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between">
                <Label className="text-sm cursor-pointer">{p.display_name}</Label>
                <Switch checked={selected.includes(p.id)} onCheckedChange={() => setSelected(s => s.includes(p.id) ? s.filter(x => x !== p.id) : [...s, p.id])} />
              </div>
            ))}
            {hasChanges && <Button size="sm" className="w-full mt-2" onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}</Button>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RoleDialog({ open, onOpenChange, role, onSaved }: any) {
  const isEdit = !!role
  const [form, setForm] = useState({ role_name: '', description: '' })
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (open) setForm({ role_name: role?.role_name || '', description: role?.description || '' }) }, [open, role])
  async function handleSubmit(e: any) {
    e.preventDefault()
    if (!form.role_name.trim()) { toast.error('Rol adı gerekli.'); return }
    setSaving(true)
    try {
      if (isEdit) await api.updateRole(role.id, form); else await api.createRole(form)
      toast.success(isEdit ? 'Rol güncellendi.' : 'Rol oluşturuldu.')
      onSaved(); onOpenChange(false)
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? 'Rolü Düzenle' : 'Yeni Rol Ekle'}</DialogTitle><DialogDescription>Rol bilgilerini doldurun.</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5"><Label>Rol Adı</Label><Input value={form.role_name} onChange={e => setForm(f => ({ ...f, role_name: e.target.value }))} placeholder="Construction Worker" /></div>
          <div className="space-y-1.5"><Label>Açıklama</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Kısa açıklama" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function Roles() {
  const [roles, setRoles] = useState<any[]>([])
  const [ppeItems, setPpeItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleDialog, setRoleDialog] = useState(false)
  const [editRole, setEditRole] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const [rr, pr] = await Promise.all([api.listRoles(), api.listPpeItems()])
      setRoles(rr.data); setPpeItems(pr.data)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleDeleteRole() {
    if (!deleteTarget) return
    try { await api.deleteRole(deleteTarget.id); toast.success('Rol silindi.'); setDeleteTarget(null); load() }
    catch (e: any) { toast.error(e.message) }
  }

  return (
    <>
      <Header fixed>
        <div className="flex items-center gap-2 ms-auto"><ThemeSwitch /></div>
      </Header>
      <Main>
        <div className="mb-6 space-y-8">
          {error && (
            <div className="flex items-center gap-2 p-4 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4" /> {error}
              <Button size="sm" variant="ghost" className="ms-auto" onClick={load}>Tekrar dene</Button>
            </div>
          )}

          {/* Roller */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Roller</h2>
                <p className="text-xs text-muted-foreground">Her role PPE gereksinimlerini buradan atayın</p>
              </div>
              <Button size="sm" onClick={() => { setEditRole(null); setRoleDialog(true) }}>
                <Plus className="h-4 w-4 mr-1" /> Yeni Rol
              </Button>
            </div>
            {loading
              ? <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
              : roles.length === 0
                ? <div className="text-center py-10 text-muted-foreground text-sm border rounded-md">Henüz rol yok</div>
                : <div className="grid gap-4 md:grid-cols-2">
                    {roles.map(r => (
                      <RoleCard
                        key={r.id}
                        role={r}
                        ppeItems={ppeItems}
                        onEdit={(r: any) => { setEditRole(r); setRoleDialog(true) }}
                        onDelete={setDeleteTarget}
                        onPpeChange={load}
                      />
                    ))}
                  </div>
            }
          </div>

          <Separator />

          {/* PPE Kataloğu — sadece görüntüleme */}
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">PPE Kataloğu</h2>
              <p className="text-xs text-muted-foreground">AI modeli tarafından algılanabilecek ekipmanlar</p>
            </div>
            {loading
              ? <div className="grid gap-3 grid-cols-2 md:grid-cols-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
              : <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {ppeItems.map((p: any) => (
                    <Card key={p.id}>
                      <CardContent className="p-4">
                        <p className="text-sm font-medium truncate">{p.display_name}</p>
                        <code className="text-xs text-muted-foreground">{p.item_key}</code>
                      </CardContent>
                    </Card>
                  ))}
                </div>
            }
          </div>
        </div>

        <RoleDialog open={roleDialog} onOpenChange={setRoleDialog} role={editRole} onSaved={load} />

        <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rolü sil?</AlertDialogTitle>
              <AlertDialogDescription><strong>{deleteTarget?.role_name}</strong> rolü kalıcı olarak silinecek.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>İptal</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteRole} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sil</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Main>
    </>
  )
}
