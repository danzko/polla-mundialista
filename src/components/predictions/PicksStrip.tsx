'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MatchPickRow, Locale } from '@/lib/types';

type Outcome = 'exact' | 'result' | 'wrong' | 'pending';

interface PicksStripProps {
  picks: MatchPickRow[];
  locale: Locale;
  myUserId?: string;
  // Current score to judge picks against: the final result if settled,
  // otherwise the live score. null before a game has any score.
  score?: { home: number; away: number } | null;
  settled?: boolean;
}

const OUTCOME_STYLES: Record<Outcome, string> = {
  exact: 'bg-amber-500/15 border-amber-500/45 text-amber-300',
  result: 'bg-emerald-500/15 border-emerald-500/45 text-emerald-300',
  wrong: 'bg-red-500/12 border-red-500/40 text-red-300',
  pending: 'bg-slate-800/40 border-border/40 text-foreground/70',
};

const PILL_STYLES: Record<Outcome, string> = {
  exact: 'bg-amber-500/25 text-amber-200',
  result: 'bg-emerald-500/25 text-emerald-200',
  wrong: 'bg-red-500/25 text-red-200',
  pending: '',
};

const RANK: Record<Outcome, number> = { exact: 0, result: 1, wrong: 2, pending: 3 };
const DISPLAY_CAP = 60; // safety ceiling; the pool is far smaller

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

/**
 * Compact, collapsible strip of every contestant's pick for a started or
 * finished group match. Picks are judged against the live score while a
 * game is in play and the final result once settled: gold = on track for
 * the exact score, green = on track for the result, red = currently out
 * of the points, neutral before any score. Points pills show once final.
 */
export function PicksStrip({ picks, locale, myUserId, score = null, settled = false }: PicksStripProps) {
  const [open, setOpen] = React.useState(false);
  if (!picks || picks.length === 0) return null;

  const es = locale === 'es';

  const outcomeOf = (p: MatchPickRow): Outcome => {
    if (!score) return 'pending';
    if (p.homeScore === score.home && p.awayScore === score.away) return 'exact';
    if (sign(p.homeScore - p.awayScore) === sign(score.home - score.away)) return 'result';
    return 'wrong';
  };
  const pointsOf = (o: Outcome) => (o === 'exact' ? 6 : o === 'result' ? 2 : 0);

  const rows = picks
    .map((p) => ({ ...p, o: outcomeOf(p) }))
    .sort((a, b) => RANK[a.o] - RANK[b.o] || a.displayName.localeCompare(b.displayName));

  const exact = rows.filter((r) => r.o === 'exact').length;
  const result = rows.filter((r) => r.o === 'result').length;
  const hasScore = !!score;

  const summary = !hasScore
    ? `${rows.length} ${es ? 'pronósticos · en juego' : 'picks · in play'}`
    : `${rows.length} ${es ? 'pronósticos' : 'picks'} · ${exact} ${es ? 'exactos' : 'exact'} · ${result} ${es ? 'aciertos' : 'correct'}${settled ? '' : (es ? ' · en vivo' : ' · live')}`;

  const shown = rows.slice(0, DISPLAY_CAP);
  const overflow = rows.length - shown.length;

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
          className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {shown.map((p) => {
            const isMe = !!myUserId && p.userId === myUserId;
            return (
              <span
                key={p.userId}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg border px-1.5 py-1 text-[11px] font-semibold leading-none',
                  OUTCOME_STYLES[p.o],
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
                {settled && p.o !== 'pending' && (
                  <span className={cn('rounded px-1 py-0.5 text-[9px] font-extrabold tabular-nums', PILL_STYLES[p.o])}>
                    {pointsOf(p.o) > 0 ? `+${pointsOf(p.o)}` : '0'}
                  </span>
                )}
              </span>
            );
          })}
          {overflow > 0 && (
            <span className="inline-flex items-center rounded-lg border border-border/40 bg-card/40 px-1.5 py-1 text-[11px] font-semibold text-muted-foreground">
              +{overflow} {es ? 'más' : 'more'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
