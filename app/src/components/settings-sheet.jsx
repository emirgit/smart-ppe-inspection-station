import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSettings, updateSettings, resetSettings } from '@/lib/settings';
import { useTheme } from '@/context/theme-provider';
import { useToast } from '@/hooks/use-toast';

export function SettingsSheet({ open, onOpenChange }) {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [apiBaseUrl, setApiBaseUrl] = useState(() => getSettings().apiBaseUrl);
  const [useMock, setUseMock] = useState(() => getSettings().useMock);

  useEffect(() => {
    if (open) {
      const s = getSettings();
      setApiBaseUrl(s.apiBaseUrl);
      setUseMock(s.useMock);
    }
  }, [open]);

  const handleSave = () => {
    updateSettings({ apiBaseUrl, useMock });
    toast({ title: 'Settings saved', description: 'Your preferences have been updated.' });
  };

  const handleReset = () => {
    resetSettings();
    setApiBaseUrl(getSettings().apiBaseUrl);
    setUseMock(getSettings().useMock);
    setTheme('system');
    toast({ title: 'Settings reset', description: 'All settings restored to defaults.' });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Configure the Admin Panel for development or production.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Theme */}
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose your preferred color scheme.
            </p>
          </div>

          <Separator />

          {/* Mock Mode */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Use Mock Data</Label>
              <p className="text-xs text-muted-foreground">
                When on, the app uses local mock data instead of the backend.
              </p>
            </div>
            <Switch checked={useMock} onCheckedChange={setUseMock} />
          </div>

          <Separator />

          {/* API URL */}
          <div className="space-y-2">
            <Label htmlFor="api-url">Backend API URL</Label>
            <Input
              id="api-url"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="http://localhost:8000"
              disabled={useMock}
            />
            <p className="text-xs text-muted-foreground">
              Express.js backend address. Disabled when mock mode is on.
            </p>
          </div>

          <Separator />

          {/* App Info */}
          <div className="space-y-3">
            <Label>About</Label>
            <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Project</span>
                <span className="font-medium">PPE Inspection Station</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Module</span>
                <span className="font-medium">MOD-05 Admin Panel</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version</span>
                <span className="font-mono">2.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Group</span>
                <span className="font-medium">GROUP-11 · CSE 396</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">Save Changes</Button>
            <Button onClick={handleReset} variant="outline">Reset</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
