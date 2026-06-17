'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MatchPickRow, Locale } from '@/lib/types';

interface PicksStripProps {
  picks: MatchPickRow[];
  locale: Locale;
  myUserId?: string;
}

const OUTCOME_STYLES: Record<MatchPickRow['outcome'], string> = {
  exact: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
  result: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
  wrong: 'bg-muted/40 border-border/50 text-muted-foreground',
  pending: 'bg-slate-800/40 border-border/40 text-foreground/70',
};

const PILL_STYLES: Record<MatchPickRow['outcome'], string> = {
  exact: 'bg-amber-500/25 text-amber-200',
  result: 'bg-emerald-500/25 text-emerald-200',
  wrong: 'bg-muted/60 text-muted-foreground',
  pending: '',
};

/**
 * Compact, collapsible strip of every contestant's pick for a started or
 * finished group match. Gold = exact (+6), green = correct result (+2),
 * muted = wrong (0); neutral until a final result lands (owner choice).
 * Collapsed by default with a summary line so 30+ picks stay tidy.
 */
export function PicksStrip({ picks, locale, myUserId }: PicksStripProps) {
  const [open, setOpen] = React.useState(false);
  if (!picks || picks.length === 0) return null;

  const es = locale === 'es';
  const exact = picks.filter((p) => p.outcome === 'exact').length;
  const result = picks.filter((p) => p.outcome === 'result').length;
  const scored = picks.some((p) => p.outcome !== 'pending');

  const summary = scored
    ? es
      ? `${picks.length} pronósticos · ${exact} exactos · ${result} aciertos`
      : `${picks.length} picks · ${exact} exact · ${result} correct`
    : es
      ? `${picks.length} pronósticos · en juego`
      : `${picks.length} picks · in play`;

  return (
    <div className="mt-1.5 rounded-xl border border-border/40 bg-card/40 px-2.5 py-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
          <span aria-hidden>👥</span>
          {summary}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {picks.map((p) => {
            const isMe = !!myUserId && p.userId === myUserId;
            return (
              <span
                key={p.userId}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg border px-1.5 py-1 text-[11px] font-semibold leading-none',
                  OUTCOME_STYLES[p.outcome],
                  isMe && 'ring-1 ring-primary/70'
                )}
              >
                <span className="max-w-[5.5rem] truncate" title={p.displayName}>
                  {p.displayName}
                  {isMe && <span className="text-primary"> ·{es ? ' tú' : ' you'}</span>}
                </span>
                <span className="tabular-nums font-extrabold">
                  {p.homeScore}-{p.awayScore}
                </span>
                {p.points !== null && (
                  <span
                    className={cn(
                      'rounded px-1 py-0.5 text-[9px] font-extrabold tabular-nums',
                      PILL_STYLES[p.outcome]
                    )}
                  >
                    {p.points > 0 ? `+${p.points}` : '0'}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
