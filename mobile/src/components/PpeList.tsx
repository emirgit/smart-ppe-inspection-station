import { Check, X } from 'lucide-react';
import type { RequiredPpeItem } from '../interfaces/display_interface';

export type PpeListVariant = 'required' | 'detected' | 'missing';

const VARIANT_STYLES: Record<
  PpeListVariant,
  { wrapper: string; icon: string; label: string }
> = {
  required: {
    wrapper:
      'bg-slate-800/70 border border-slate-600 text-slate-100',
    icon: 'text-amber-300',
    label: 'Required',
  },
  detected: {
    wrapper:
      'bg-emerald-900/60 border border-emerald-500/70 text-emerald-50',
    icon: 'text-emerald-300',
    label: 'Detected',
  },
  missing: {
    wrapper:
      'bg-rose-900/70 border border-rose-500/80 text-rose-50',
    icon: 'text-rose-200',
    label: 'Missing',
  },
};

export interface PpeListProps {
  items: RequiredPpeItem[];
  variant: PpeListVariant;
  testId?: string;
}

export function PpeList({ items, variant, testId }: PpeListProps) {
  const style = VARIANT_STYLES[variant];
  if (items.length === 0) {
    return (
      <p className="text-slate-300 italic" data-testid={testId}>
        No items.
      </p>
    );
  }
  return (
    <ul
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full"
      data-testid={testId}
    >
      {items.map((item) => (
        <li
          key={`${variant}-${item.id}-${item.item_key}`}
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${style.wrapper}`}
        >
          <span className={`shrink-0 ${style.icon}`}>
            {variant === 'missing' ? <X size={28} /> : <Check size={28} />}
          </span>
          <div className="flex flex-col">
            <span className="text-2xl font-semibold leading-tight">
              {item.display_name || item.item_key}
            </span>
            <span className="text-sm uppercase tracking-wider opacity-70">
              {style.label}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
