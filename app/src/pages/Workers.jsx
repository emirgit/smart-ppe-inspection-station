import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Pencil, UserX, Users } from 'lucide-react';
import { api, ApiError } from '@/services/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { useToast } from '@/hooks/use-toast';

function WorkerForm({ initial, roles, onSubmit, onCancel, submitLabel, isEdit }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.full_name || !form.rfid_card_uid || !form.role_id) {
      setError('All fields are required.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ ...form, role_id: Number(form.role_id) });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">Full Name</Label>
        <Input
          id="full_name"
          value={form.full_name}
          onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))}
          placeholder="Enter worker name"
          required
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rfid_card_uid">RFID Card UID</Label>
        <Input
          id="rfid_card_uid"
          value={form.rfid_card_uid}
          onChange={(e) => setForm(f => ({ ...f, rfid_card_uid: e.target.value.toUpperCase() }))}
          placeholder="A1B2C3D4"
          className="font-mono uppercase"
          maxLength={20}
          required
        />
        <p className="text-xs text-muted-foreground">
          Type the UID printed on the card or shown by the RC522 reader.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="role_id">Job Role</Label>
        <Select value={String(form.role_id || '')} onValueChange={(v) => setForm(f => ({ ...f, role_id: v }))}>
          <SelectTrigger>
            <SelectValue placeholder="Select a role..." />
          </SelectTrigger>
          <SelectContent>
            {roles.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.role_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [w, r] = await Promise.all([api.listWorkers(), api.listRoles()]);
      setWorkers(w.data);
      setRoles(r.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRegister = async (data) => {
    const res = await api.createWorker(data);
    setWorkers(prev => [...prev, res.data]);
    setRegisterOpen(false);
    toast({ title: 'Worker registered', description: `${res.data.full_name} has been added.` });
  };

  const handleEdit = async (data) => {
    const res = await api.updateWorker(editTarget.id, data);
    setWorkers(prev => prev.map(w => w.id === editTarget.id ? res.data : w));
    setEditTarget(null);
    toast({ title: 'Worker updated', description: `${res.data.full_name} has been updated.` });
  };

  const handleDeactivate = async () => {
    try {
      await api.softDeleteWorker(deactivateTarget.id);
      setWorkers(prev => prev.map(w => w.id === deactivateTarget.id ? { ...w, is_active: false } : w));
      toast({ title: 'Worker deactivated', description: `${deactivateTarget.full_name} can no longer enter.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed', description: err.message });
    } finally {
      setDeactivateTarget(null);
    }
  };

  const filtered = workers.filter(w => {
    const s = search.toLowerCase();
    if (s && !w.full_name.toLowerCase().includes(s) && !w.rfid_card_uid.toLowerCase().includes(s)) return false;
    if (filterRole !== 'ALL' && String(w.role_id) !== filterRole) return false;
    if (filterStatus === 'ACTIVE' && !w.is_active) return false;
    if (filterStatus === 'INACTIVE' && w.is_active) return false;
    return true;
  });

  const activeCount = workers.filter(w => w.is_active).length;

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
          <h1 className="text-2xl font-bold tracking-tight">Workers</h1>
          <p className="text-sm text-muted-foreground">{activeCount} active workers registered</p>
        </div>
        <Button onClick={() => setRegisterOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Register Worker
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
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            {roles.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.role_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No workers found"
            description={search || filterRole !== 'ALL' || filterStatus !== 'ALL'
              ? "Try adjusting your filters."
              : "Get started by registering your first worker."}
            action={!search && filterRole === 'ALL' && filterStatus === 'ALL' && (
              <Button onClick={() => setRegisterOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Register Worker
              </Button>
            )}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>RFID UID</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(w => (
                <TableRow key={w.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                        w.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {w.full_name[0]}
                      </div>
                      <span className="font-medium">{w.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono">{w.rfid_card_uid}</code>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{w.role_name}</TableCell>
                  <TableCell><StatusBadge active={w.is_active} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(w.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditTarget(w)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {w.is_active && (
                        <Button variant="ghost" size="icon" onClick={() => setDeactivateTarget(w)}>
                          <UserX className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Register Dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register New Worker</DialogTitle>
            <DialogDescription>
              Add a new worker and link their RFID card to a job role.
            </DialogDescription>
          </DialogHeader>
          <WorkerForm
            initial={{ full_name: '', rfid_card_uid: '', role_id: '' }}
            roles={roles}
            onSubmit={handleRegister}
            onCancel={() => setRegisterOpen(false)}
            submitLabel="Register Worker"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Worker</DialogTitle>
            <DialogDescription>
              Update worker information. Changes apply immediately.
            </DialogDescription>
          </DialogHeader>
          {editTarget && (
            <WorkerForm
              initial={{
                full_name: editTarget.full_name,
                rfid_card_uid: editTarget.rfid_card_uid,
                role_id: editTarget.role_id,
              }}
              roles={roles}
              onSubmit={handleEdit}
              onCancel={() => setEditTarget(null)}
              submitLabel="Save Changes"
              isEdit
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Deactivate AlertDialog */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this worker?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget?.full_name} will no longer pass through the turnstile.
              Their entry log history will be preserved. You can reactivate them later by editing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
