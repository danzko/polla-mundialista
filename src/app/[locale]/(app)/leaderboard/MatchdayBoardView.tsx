'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MatchdayBoard, Locale } from '@/lib/types';

/**
 * "Esta jornada": the weekly board. Everyone ranked by this matchday's points
 * (banker doubled), the jornada winner crowned once the round is complete (+5).
 */
export function MatchdayBoardView({ board, locale }: { board: MatchdayBoard | null; locale: Locale }) {
  const es = locale === 'es';
  const router = useRouter();

  if (!board || board.matchdays.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-8 text-center text-sm text-muted-foreground">
        {es ? 'La jornada aparece aquí cuando arranque el primer partido.' : 'The matchday board appears once the first game kicks off.'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* matchday selector */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {board.matchdays.map((md) => (
          <button
            key={md}
            type="button"
            onClick={() => router.push(`/${locale}/leaderboard?league=${board.leagueId}&md=${md}&tab=jornada`, { scroll: false })}
            className={cn('shrink-0 min-h-9 rounded-full border px-3.5 py-1.5 text-xs font-bold', md === board.matchday ? 'border-primary bg-primary text-primary-foreground' : 'border-border/50 bg-card text-muted-foreground')}
          >
            J{md}
          </button>
        ))}
        <span className={cn('ml-auto shrink-0 self-center rounded-full px-2.5 py-1 text-[11px] font-bold', board.complete ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300')}>
          {board.complete ? (es ? 'Jornada cerrada' : 'Round complete') : (es ? 'En curso' : 'In progress')}
        </span>
      </div>

      {/* board */}
      <ol className="overflow-hidden rounded-2xl border border-border/50 bg-card">
        {board.entries.map((e) => (
          <li key={e.userId} className={cn('flex items-center gap-3 border-t border-border/30 px-3.5 py-2.5 first:border-t-0 text-sm', e.isMe && 'bg-primary/[0.07]')}>
            <span className={cn('w-6 text-center text-xs font-extrabold tabular-nums', e.rank === 1 ? 'text-amber-300' : 'text-muted-foreground')}>{e.rank}</span>
            <span className="min-w-0 flex-1">
              <span className={cn('flex items-center gap-1.5 truncate font-bold', e.isMe && 'text-primary')}>
                {e.isWinner && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-label={es ? 'Ganó la jornada' : 'Won the matchday'} />}
                {e.displayName}{e.isMe ? (es ? ' (tú)' : ' (you)') : ''}
              </span>
            </span>
            <span className="shrink-0 text-base font-extrabold tabular-nums">{e.points}{e.isWinner && <span className="ml-1 text-[11px] font-bold text-amber-300">+5</span>}</span>
          </li>
        ))}
      </ol>
      <p className="text-center text-[11px] text-muted-foreground">
        {es ? 'La Fija cuenta doble · el mejor de la jornada suma +5' : 'Banker counts double · matchday winner gets +5'}
      </p>
    </div>
  );
}
