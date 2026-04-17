import { UserRound } from 'lucide-react';
import type { DisplayWorker } from '../lib/normalize';

export interface WorkerCardProps {
  worker: DisplayWorker;
}

export function WorkerCard({ worker }: WorkerCardProps) {
  return (
    <div className="flex items-center gap-4 bg-white/5 px-5 py-3 rounded-2xl border border-white/10">
      <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
        {worker.photo_url ? (
          <img
            src={worker.photo_url}
            alt={worker.full_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <UserRound className="text-slate-300" size={36} />
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-3xl font-bold leading-tight">
          {worker.full_name}
        </span>
        <span className="text-base uppercase tracking-widest opacity-70">
          {worker.role_name}
        </span>
      </div>
    </div>
  );
}
