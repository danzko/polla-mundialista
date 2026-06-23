'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MatchPickRow, Locale } from '@/lib/types';

type State = 'exact' | 'result' | 'wrong' | 'pending' | 'none';

interface PicksStripProps {
  picks: MatchPickRow[];
  locale: Locale;
  myUserId?: string;
  // Current score to judge picks against: the final result if settled,
  // otherwise the live score. null before a game has any score.
  score?: { home: number; away: number } | null;
  settled?: boolean;
}

const STYLES: Record<State, string> = {
  exact: 'bg-amber-500/15 border-amber-500/45 text-amber-300',
  result: 'bg-emerald-500/15 border-emerald-500/45 text-emerald-300',
  wrong: 'bg-red-500/12 border-red-500/40 text-red-300',
  pending: 'bg-slate-800/40 border-border/40 text-foreground/70',
  none: 'bg-transparent border-border/25 text-muted-foreground/55',
};

const PILL_STYLES: Record<State, string> = {
  exact: 'bg-amber-500/25 text-amber-200',
  result: 'bg-emerald-500/25 text-emerald-200',
  wrong: 'bg-red-500/25 text-red-200',
  pending: '',
  none: '',
};

const RANK: Record<State, number> = { exact: 0, result: 1, wrong: 2, pending: 3, none: 4 };
const DISPLAY_CAP = 60;

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

/**
 * Compact, collapsible strip of EVERY league-mate for a started/finished
 * group match — including those who didn't enter a pick (shown dim with
 * "—"). Picks are judged against the live score in play and the final
 * result once settled: gold = on track for exact, green = on track for
 * the result, red = currently out of the points, neutral before any
 * score. Points pills show once final.
 */
export function PicksStrip({ picks, locale, myUserId, score = null, settled = false }: PicksStripProps) {
  const [open, setOpen] = React.useState(false);
  if (!picks || picks.length === 0) return null;

  const es = locale === 'es';

  const stateOf = (p: MatchPickRow): State => {
    if (p.homeScore === null || p.awayScore === null) return 'none';
    if (!score) return 'pending';
    if (p.homeScore === score.home && p.awayScore === score.away) return 'exact';
    if (sign(p.homeScore - p.awayScore) === sign(score.home - score.away)) return 'result';
    return 'wrong';
  };
  const pointsOf = (s: State) => (s === 'exact' ? 6 : s === 'result' ? 2 : 0);

  const rows = picks
    .map((p) => ({ ...p, s: stateOf(p) }))
    .sort((a, b) => RANK[a.s] - RANK[b.s] || a.displayName.localeCompare(b.displayName));

  const exact = rows.filter((r) => r.s === 'exact').length;
  const result = rows.filter((r) => r.s === 'result').length;
  const noPick = rows.filter((r) => r.s === 'none').length;
  const hasScore = !!score;

  const tail = noPick > 0 ? ` · ${noPick} ${es ? 'sin jugar' : 'no pick'}` : '';
  const summary = !hasScore
    ? `${rows.length} ${es ? 'jugadores · en juego' : 'players · in play'}${tail}`
    : `${rows.length} ${es ? 'jugadores' : 'players'} · ${exact} ${es ? 'exactos' : 'exact'} · ${result} ${es ? 'aciertos' : 'correct'}${settled ? '' : (es ? ' · en vivo' : ' · live')}${tail}`;

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
            const noEntry = p.s === 'none';
            return (
              <span
                key={p.userId}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg border px-1.5 py-1 text-[11px] font-semibold leading-none',
                  STYLES[p.s],
                  isMe && 'ring-1 ring-primary/70'
                )}
              >
                <span className="max-w-[5.5rem] truncate" title={p.displayName}>
                  {p.displayName}
                  {isMe && <span className="text-primary"> ·{es ? ' tú' : ' you'}</span>}
                </span>
                <span className={cn('tabular-nums', noEntry ? 'font-normal opacity-70' : 'font-extrabold')}>
                  {noEntry ? (es ? 'sin jugar' : '—') : `${p.homeScore}-${p.awayScore}`}
                </span>
                {settled && !noEntry && p.s !== 'pending' && (
                  <span className={cn('rounded px-1 py-0.5 text-[9px] font-extrabold tabular-nums', PILL_STYLES[p.s])}>
                    {pointsOf(p.s) > 0 ? `+${pointsOf(p.s)}` : '0'}
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
