import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Rank marker: gold / silver / bronze discs for the podium, a plain numeral
 * below. One vocabulary for every standings surface (no medal emoji).
 */
export function RankBadge({ rank, size = 'md', className }: { rank: number; size?: 'sm' | 'md'; className?: string }) {
  const podium = rank >= 1 && rank <= 3;
  const tone =
    rank === 1 ? 'bg-amber-400 text-amber-950 ring-amber-200/70'
    : rank === 2 ? 'bg-slate-300 text-slate-900 ring-slate-100/70'
    : rank === 3 ? 'bg-amber-700 text-amber-50 ring-amber-500/60'
    : '';
  const dim = size === 'sm' ? 'h-5 w-5 text-[11px]' : 'h-6 w-6 text-xs';
  if (!podium) {
    return <span className={cn('inline-flex items-center justify-center font-bold tabular-nums text-muted-foreground', dim, className)}>{rank}</span>;
  }
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-extrabold tabular-nums ring-1 ring-inset shadow-sm', dim, tone, className)}
      aria-label={`#${rank}`}
    >
      {rank}
    </span>
  );
}
