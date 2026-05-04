import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Shield, Package } from 'lucide-react';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { ErrorState } from '@/components/error-state';
import { EmptyState } from '@/components/empty-state';
import { useToast } from '@/hooks/use-toast';

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [ppeItems, setPpeItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [editPpeTarget, setEditPpeTarget] = useState(null);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState(null);
  const [createPpeOpen, setCreatePpeOpen] = useState(false);
  const [deletePpeTarget, setDeletePpeTarget] = useState(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [r, p] = await Promise.all([api.listRoles(), api.listPpeItems()]);
      setRoles(r.data);
      setPpeItems(p.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreateRole = async (data) => {
    try {
      const res = await api.createRole(data);
      setRoles(prev => [...prev, { ...res.data, ppe_items: [], worker_count: 0 }]);
      setCreateRoleOpen(false);
      toast({ title: 'Role created', description: `${res.data.role_name} has been added.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed', description: err.message });
    }
  };

  const handleSavePpe = async (selectedIds) => {
    try {
      await api.replaceRolePpe(editPpeTarget.id, { ppe_item_ids: selectedIds });
      setRoles(prev => prev.map(r => r.id === editPpeTarget.id
        ? { ...r, required_ppe: selectedIds, ppe_items: ppeItems.filter(p => selectedIds.includes(p.id)) }
        : r
      ));
      setEditPpeTarget(null);
      toast({ title: 'PPE requirements updated', description: `${editPpeTarget.role_name} updated.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed', description: err.message });
    }
  };

  const handleDeleteRole = async () => {
    try {
      await api.deleteRole(deleteRoleTarget.id);
      setRoles(prev => prev.filter(r => r.id !== deleteRoleTarget.id));
      toast({ title: 'Role deleted', description: `${deleteRoleTarget.role_name} has been removed.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Cannot delete', description: err.message });
    } finally {
      setDeleteRoleTarget(null);
    }
  };

  const handleCreatePpeItem = async (data) => {
    try {
      const res = await api.createPpeItem(data);
      setPpeItems(prev => [...prev, res.data]);
      setCreatePpeOpen(false);
      toast({ title: 'PPE item created', description: `${res.data.display_name} added.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed', description: err.message });
    }
  };

  const handleDeletePpe = async () => {
    try {
      await api.deletePpeItem(deletePpeTarget.id);
      setPpeItems(prev => prev.filter(p => p.id !== deletePpeTarget.id));
      toast({ title: 'PPE item deleted' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Cannot delete', description: err.message });
    } finally {
      setDeletePpeTarget(null);
    }
  };

  if (loading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-8 w-48" /><div className="grid grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48" />)}</div></div>;
  }

  if (error) return <div className="p-8"><ErrorState description={error} onRetry={load} /></div>;

  return (
    <div className="p-8 space-y-8">
      {/* ── Roles ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Roles & PPE</h1>
            <p className="text-sm text-muted-foreground">Configure required PPE for each job role</p>
          </div>
          <Button onClick={() => setCreateRoleOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Role
          </Button>
        </div>

        {roles.length === 0 ? (
          <Card>
            <EmptyState icon={Shield} title="No roles yet" description="Create your first role to assign PPE requirements." />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {roles.map(role => (
              <Card key={role.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Shield className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{role.role_name}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">{role.description || 'No description'}</CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditPpeTarget(role)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteRoleTarget(role)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Required PPE</p>
                    {(role.worker_count || 0) > 0 && (
                      <Badge variant="outline" className="text-xs">{role.worker_count} worker{role.worker_count !== 1 ? 's' : ''}</Badge>
                    )}
                  </div>
                  {(role.ppe_items || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No PPE assigned</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(role.ppe_items || []).map(item => (
                        <Badge key={item.id} variant="secondary" className="font-normal">
                          {item.display_name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* ── PPE Items ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">PPE Item Catalog</h2>
            <p className="text-sm text-muted-foreground">Master list of PPE types the AI model can detect</p>
          </div>
          <Button variant="outline" onClick={() => setCreatePpeOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New PPE Item
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            {ppeItems.length === 0 ? (
              <EmptyState icon={Package} title="No PPE items" description="Add PPE types that workers may need." />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {ppeItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between rounded-md border bg-card p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.display_name}</p>
                      <code className="text-xs text-muted-foreground font-mono">{item.item_key}</code>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setDeletePpeTarget(item)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Create Role Dialog */}
      <Dialog open={createRoleOpen} onOpenChange={setCreateRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>Define a job role. PPE requirements can be assigned after.</DialogDescription>
          </DialogHeader>
          <RoleForm onSubmit={handleCreateRole} onCancel={() => setCreateRoleOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit PPE Dialog */}
      <Dialog open={!!editPpeTarget} onOpenChange={(o) => !o && setEditPpeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>PPE Requirements</DialogTitle>
            <DialogDescription>
              Select all PPE items required for {editPpeTarget?.role_name}.
            </DialogDescription>
          </DialogHeader>
          {editPpeTarget && (
            <PpeCheckList
              ppeItems={ppeItems}
              initial={editPpeTarget.required_ppe}
              onSubmit={handleSavePpe}
              onCancel={() => setEditPpeTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create PPE Dialog */}
      <Dialog open={createPpeOpen} onOpenChange={setCreatePpeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create PPE Item</DialogTitle>
            <DialogDescription>
              Add a new PPE type. The item_key must match the AI model's detection class.
            </DialogDescription>
          </DialogHeader>
          <PpeForm onSubmit={handleCreatePpeItem} onCancel={() => setCreatePpeOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Delete Role */}
      <AlertDialog open={!!deleteRoleTarget} onOpenChange={(o) => !o && setDeleteRoleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this role?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteRoleTarget?.role_name} will be permanently deleted. This cannot be undone.
              {deleteRoleTarget?.worker_count > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  Warning: {deleteRoleTarget.worker_count} active worker(s) are assigned to this role.
                  You must reassign or deactivate them first.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRole} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete PPE */}
      <AlertDialog open={!!deletePpeTarget} onOpenChange={(o) => !o && setDeletePpeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this PPE item?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletePpeTarget?.display_name} will be removed from the catalog. This may fail if any role currently uses it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePpe} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RoleForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ role_name: '', description: '' });
  const [saving, setSaving] = useState(false);

  return (
    <form onSubmit={async (e) => { e.preventDefault(); setSaving(true); await onSubmit(form); setSaving(false); }} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="role_name">Role Name</Label>
        <Input id="role_name" value={form.role_name} onChange={(e) => setForm(f => ({ ...f, role_name: e.target.value }))} placeholder="e.g. Welder" required autoFocus />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Input id="description" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of the role" />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving || !form.role_name}>{saving ? 'Creating...' : 'Create Role'}</Button>
      </DialogFooter>
    </form>
  );
}

function PpeForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ item_key: '', display_name: '', icon_name: '' });
  const [saving, setSaving] = useState(false);

  return (
    <form onSubmit={async (e) => { e.preventDefault(); setSaving(true); await onSubmit(form); setSaving(false); }} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="display_name">Display Name</Label>
        <Input id="display_name" value={form.display_name} onChange={(e) => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="e.g. Welding Helmet" required autoFocus />
      </div>
      <div className="space-y-2">
        <Label htmlFor="item_key">Item Key</Label>
        <Input id="item_key" value={form.item_key} onChange={(e) => setForm(f => ({ ...f, item_key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))} placeholder="welding_helmet" className="font-mono" required />
        <p className="text-xs text-muted-foreground">Lowercase with underscores. Must match AI detection class.</p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving || !form.display_name || !form.item_key}>{saving ? 'Creating...' : 'Create'}</Button>
      </DialogFooter>
    </form>
  );
}

function PpeCheckList({ ppeItems, initial, onSubmit, onCancel }) {
  const [selected, setSelected] = useState(initial);
  const [saving, setSaving] = useState(false);

  const toggle = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2 max-h-72 overflow-y-auto rounded-md border p-2">
        {ppeItems.map(item => (
          <label key={item.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-accent cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={() => toggle(item.id)}
              className="h-4 w-4 rounded border-input"
            />
            <div className="flex-1">
              <p className="text-sm font-medium">{item.display_name}</p>
              <code className="text-xs text-muted-foreground font-mono">{item.item_key}</code>
            </div>
          </label>
        ))}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={async () => { setSaving(true); await onSubmit(selected); setSaving(false); }} disabled={saving}>
          {saving ? 'Saving...' : 'Save Requirements'}
        </Button>
      </DialogFooter>
    </div>
  );
}
