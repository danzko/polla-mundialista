'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Swords, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MatchdayBoard, Locale } from '@/lib/types';

/**
 * "Esta jornada": the weekly board. Everyone ranked by this matchday's points
 * (banker doubled), the jornada winner crowned once the round is complete
 * (+5), and each member's duel with its result.
 */
export function MatchdayBoardView({ board, locale }: { board: MatchdayBoard | null; locale: Locale }) {
  const es = locale === 'es';
  const router = useRouter();

  if (!board || board.matchdays.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/50 p-8 text-center text-sm text-muted-foreground">
        {es ? 'La jornada aparece aquí cuando arranque el primer partido.' : 'The matchday board appears once the first game kicks off.'}
      </div>
    );
  }

  const me = board.entries.find((e) => e.isMe) ?? null;
  const duelWord = (d: MatchdayBoard['entries'][number]['duel']) =>
    d === 'win' ? (es ? 'ganó' : 'won') : d === 'loss' ? (es ? 'perdió' : 'lost') : d === 'draw' ? (es ? 'empate' : 'draw') : d === 'bye' ? (es ? 'descansa' : 'bye') : (es ? 'en juego' : 'live');

  return (
    <div className="space-y-3">
      {/* matchday selector */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {board.matchdays.map((md) => (
          <button
            key={md}
            type="button"
            onClick={() => router.push(`/${locale}/leaderboard?league=${board.leagueId}&md=${md}&tab=jornada`, { scroll: false })}
            className={cn('shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold', md === board.matchday ? 'border-primary bg-primary text-primary-foreground' : 'border-border/50 bg-card/60 text-muted-foreground')}
          >
            J{md}
          </button>
        ))}
        <span className={cn('ml-auto shrink-0 self-center rounded-full px-2.5 py-1 text-[11px] font-bold', board.complete ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300')}>
          {board.complete ? (es ? 'Jornada cerrada' : 'Round complete') : (es ? 'En curso' : 'In progress')}
        </span>
      </div>

      {/* my duel */}
      {me && me.opponentName && (
        <div className={cn('flex items-center justify-between gap-3 rounded-2xl border px-4 py-3',
          me.duel === 'win' ? 'border-emerald-500/40 bg-emerald-500/[0.08]' : me.duel === 'loss' ? 'border-rose-500/40 bg-rose-500/[0.06]' : 'border-primary/40 bg-primary/[0.06]')}>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5"><Swords className="h-3.5 w-3.5" />{es ? 'Tu duelo' : 'Your duel'} · J{board.matchday}</div>
            <div className="truncate text-base font-bold">{es ? 'Tú' : 'You'} <span className="text-muted-foreground font-medium">vs</span> {me.opponentName}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xl font-extrabold tabular-nums">{me.points} <span className="text-muted-foreground">–</span> {board.entries.find((e) => e.userId === me.opponentId)?.points ?? 0}</div>
            <div className={cn('text-[11px] font-bold uppercase tracking-wider', me.duel === 'win' ? 'text-emerald-400' : me.duel === 'loss' ? 'text-rose-400' : 'text-muted-foreground')}>{duelWord(me.duel)}</div>
          </div>
        </div>
      )}

      {/* board */}
      <ol className="overflow-hidden rounded-2xl border border-border/50 bg-card/50">
        {board.entries.map((e) => (
          <li key={e.userId} className={cn('flex items-center gap-3 border-t border-border/30 px-3.5 py-2.5 first:border-t-0 text-sm', e.isMe && 'bg-primary/[0.07]')}>
            <span className={cn('w-6 text-center text-xs font-extrabold tabular-nums', e.rank === 1 ? 'text-amber-300' : 'text-muted-foreground')}>{e.rank}</span>
            <span className="min-w-0 flex-1">
              <span className={cn('flex items-center gap-1.5 truncate font-bold', e.isMe && 'text-primary')}>
                {e.isWinner && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-label={es ? 'Ganó la jornada' : 'Won the matchday'} />}
                {e.displayName}{e.isMe ? (es ? ' (tú)' : ' (you)') : ''}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {e.opponentName ? (
                  <>
                    <span className={cn('font-semibold', e.duel === 'win' ? 'text-emerald-400' : e.duel === 'loss' ? 'text-rose-400' : '')}>{duelWord(e.duel)}</span>
                    {' '}vs {e.opponentName}
                  </>
                ) : (es ? 'descansa esta jornada' : 'bye this round')}
              </span>
            </span>
            <span className="shrink-0 text-base font-extrabold tabular-nums">{e.points}{e.isWinner && <span className="ml-1 text-[11px] font-bold text-amber-300">+5</span>}</span>
          </li>
        ))}
      </ol>
      <p className="text-center text-[11px] text-muted-foreground">
        {es ? 'La Fija cuenta doble · el mejor de la jornada suma +5 · los duelos se sortean cada jornada' : 'Banker counts double · matchday winner gets +5 · duels are drawn every round'}
      </p>
    </div>
  );
}
