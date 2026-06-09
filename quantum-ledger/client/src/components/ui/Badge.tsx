import { cn } from '@/lib/utils';

const colorMap: Record<string, string> = {
  active: 'bg-blue-900/50 text-blue-300 border-blue-700',
  completed: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
  cancelled: 'bg-slate-800 text-slate-400 border-slate-600',
  failed: 'bg-red-900/50 text-red-300 border-red-700',
  pending: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  in_progress: 'bg-blue-900/50 text-blue-300 border-blue-700',
  done: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
  in_transit: 'bg-purple-900/50 text-purple-300 border-purple-700',
  sold: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
  partial: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  mining: 'bg-amber-900/50 text-amber-300 border-amber-700',
  trading: 'bg-cyan-900/50 text-cyan-300 border-cyan-700',
  crafting: 'bg-violet-900/50 text-violet-300 border-violet-700',
  contract: 'bg-pink-900/50 text-pink-300 border-pink-700',
  complete: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
};

interface BadgeProps {
  label: string;
  className?: string;
}

export function Badge({ label, className }: BadgeProps) {
  const color = colorMap[label] ?? 'bg-slate-800 text-slate-400 border-slate-600';
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', color, className)}>
      {label}
    </span>
  );
}
