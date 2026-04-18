import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { ConnectionStatus } from '../interfaces/display_interface';

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  [ConnectionStatus.CONNECTING]: 'Connecting',
  [ConnectionStatus.CONNECTED]: 'Online',
  [ConnectionStatus.DISCONNECTED]: 'Offline',
  [ConnectionStatus.RECONNECTING]: 'Reconnecting',
  [ConnectionStatus.FAILED]: 'Disconnected',
};

export interface ConnectionBadgeProps {
  status: ConnectionStatus;
  mock?: boolean;
}

export function ConnectionBadge({ status, mock }: ConnectionBadgeProps) {
  const isUp = status === ConnectionStatus.CONNECTED;
  const isWorking =
    status === ConnectionStatus.CONNECTING ||
    status === ConnectionStatus.RECONNECTING;

  return (
    <div
      data-testid="connection-badge"
      className="absolute top-4 right-4 flex items-center gap-2 text-sm font-semibold px-3 py-1 rounded-full bg-black/30 border border-white/10"
    >
      {isWorking ? (
        <Loader2 className="animate-spin text-amber-300" size={18} />
      ) : isUp ? (
        <Wifi className="text-emerald-400" size={18} />
      ) : (
        <WifiOff className="text-rose-400" size={18} />
      )}
      <span>{mock ? 'Mock Mode' : STATUS_LABEL[status]}</span>
    </div>
  );
}
