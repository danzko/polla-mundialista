'use client';

import * as React from 'react';
import { ScoreStepper } from './ScoreStepper';
import { PicksStrip } from './PicksStrip';
import { knockoutSlotLabel } from '@/lib/bracket-slots';
import { cn } from '@/lib/utils';
import type { MatchView, Locale, MatchPickRow, LiveScore } from '@/lib/types';

interface FeedMatchCardProps {
  match: MatchView;
  locale: Locale;
  live?: LiveScore | null;
  editable: boolean;
  homeScore: number;
  awayScore: number;
  onChange?: (matchId: string, homeScore: number, awayScore: number) => void;
  picks?: MatchPickRow[];
  myUserId?: string;
}

/**
 * Compact timeline-feed card. Renders four states off one scoreboard
 * layout: editable (steppers), live (running score + EN VIVO clock),
 * final (score + your result/points), and locked-upcoming (your pick +
 * close time). The contestant pick strip tucks underneath once started.
 */
export function FeedMatchCard({
  match, locale, live, editable, homeScore, awayScore, onChange, picks, myUserId,
}: FeedMatchCardProps) {
  const es = locale === 'es';

  const name = (team: MatchView['homeTeam'], pos: 'home' | 'away') =>
    team
      ? (es ? team.nameEs : team.nameEn)
      : (knockoutSlotLabel(match.matchNumber, pos, locale) ?? (es ? 'Por definir' : 'TBD'));
  const flag = (team: MatchView['homeTeam']) => (team ? team.flagEmoji : '🏳️');

  // Always US Eastern (ET) — the lock clock — so the close time matches what
  // everyone else sees regardless of their device timezone.
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(es ? 'es-CO' : 'en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }) + ' ET';

  const kickoff = new Date(match.kickoffAt).getTime();
  const started = Date.now() >= kickoff;
  const isLive = !match.isVoided && live?.status === 'in';

  const finalScore =
    match.result ??
    (live?.completed && live.homeScore != null && live.awayScore != null
      ? { homeScore: live.homeScore, awayScore: live.awayScore }
      : null);
  const isFinal = !isLive && !!finalScore;

  // Score shown in the center column
  const shownScore = isLive
    ? { h: live!.homeScore ?? 0, a: live!.awayScore ?? 0 }
    : isFinal
      ? { h: finalScore!.homeScore, a: finalScore!.awayScore }
      : null;

  // Right-side status badge
  const badge = (() => {
    if (match.isVoided) {
      return <span className="rounded text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 bg-destructive/10 text-destructive border border-destructive/30">{es ? 'anulado' : 'void'}</span>;
    }
    if (isLive) {
      return (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold text-red-300 bg-red-500/15 border border-red-500/40">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          {es ? 'en vivo' : 'live'} {live?.displayClock || ''}
        </span>
      );
    }
    if (isFinal) {
      return <span className="rounded text-[10px] font-bold uppercase px-1.5 py-0.5 bg-secondary/70 text-muted-foreground border border-border/50">{es ? 'fin' : 'FT'}</span>;
    }
    if (editable) {
      return <span className="text-[10px] font-medium text-muted-foreground">{fmtTime(match.kickoffAt)}</span>;
    }
    // locked but not started, or started without data yet
    if (!started) {
      return <span className="rounded text-[10px] font-semibold px-1.5 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/25">{es ? 'cerrado' : 'locked'}</span>;
    }
    return <span className="rounded text-[10px] font-semibold px-1.5 py-0.5 bg-secondary/70 text-muted-foreground border border-border/50">{es ? 'en juego' : 'in play'}</span>;
  })();

  // Your-pick + points sub-row
  const pts = match.pointsEarned;
  const pointsPill =
    pts === null || match.isVoided ? null : (
      <span className={cn(
        'rounded px-1.5 py-0.5 text-[10px] font-bold',
        pts >= 6 ? 'bg-amber-500/20 text-amber-300'
          : pts > 0 ? 'bg-emerald-500/20 text-emerald-300'
            : 'bg-muted/60 text-muted-foreground'
      )}>
        {pts > 0 ? `+${pts}` : '0'}
      </span>
    );

  // Time-gradient styling: past recedes, present pops, future neutral.
  const inPlay = !isLive && !isFinal && started && !match.isVoided;
  const isPast = isFinal && !match.isVoided;
  const phaseClass = isLive
    ? 'border-red-500/70 bg-red-500/[0.05]'
    : inPlay
      ? 'border-foreground/25 bg-foreground/[0.03]'
      : isPast
        ? 'border-border/25 bg-muted/10 opacity-[0.93]'
        : 'border-border/55 bg-card/50'; // future / neutral

  return (
    <div>
      <div className={cn(
        'rounded-xl border px-2.5 py-2 transition-colors',
        phaseClass,
        match.isVoided && 'opacity-60'
      )}>
        {/* meta row */}
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
            {match.stage === 'group'
              ? `${es ? 'Grupo' : 'Group'} ${match.groupLabel ?? ''}`
              : (es ? 'Eliminatoria' : 'Knockout')}
            {!editable && !isLive && !isFinal && !match.isVoided && (
              <span className="ml-1.5 font-medium normal-case tracking-normal">· {fmtTime(match.kickoffAt)}</span>
            )}
          </span>
          {badge}
        </div>

        {/* scoreboard row */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex items-center justify-end gap-1.5 min-w-0 text-[13px] font-semibold">
            <span className="truncate">{name(match.homeTeam, 'home')}</span>
            <span className="text-base leading-none shrink-0">{flag(match.homeTeam)}</span>
          </div>

          <div className="shrink-0 text-center">
            {shownScore ? (
              <span className={cn(
                'font-extrabold tabular-nums',
                isLive ? 'text-[17px] text-foreground' : 'text-[15px]'
              )}>
                {shownScore.h} <span className="text-muted-foreground font-normal">–</span> {shownScore.a}
              </span>
            ) : !editable ? (
              <span className="text-[11px] font-semibold uppercase text-muted-foreground/70">vs</span>
            ) : null}
          </div>

          <div className="flex items-center justify-start gap-1.5 min-w-0 text-[13px] font-semibold">
            <span className="text-base leading-none shrink-0">{flag(match.awayTeam)}</span>
            <span className="truncate">{name(match.awayTeam, 'away')}</span>
          </div>
        </div>

        {/* editable steppers */}
        {editable && (
          <div className="mt-2 flex items-center justify-center gap-3">
            <ScoreStepper value={homeScore} onChange={(v) => onChange?.(match.id, v, awayScore)} />
            <span className="text-xs text-muted-foreground">–</span>
            <ScoreStepper value={awayScore} onChange={(v) => onChange?.(match.id, homeScore, v)} />
          </div>
        )}

        {/* your pick + points (non-editable, when you predicted) */}
        {!editable && match.myPrediction && (
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>
              {es ? 'tu' : 'you'}{' '}
              <span className="font-semibold text-foreground/90 tabular-nums">
                {match.myPrediction.homeScore}-{match.myPrediction.awayScore}
              </span>
            </span>
            {pointsPill}
          </div>
        )}
      </div>

      {started && (
        <PicksStrip
          picks={picks ?? []}
          locale={locale}
          myUserId={myUserId}
          score={shownScore ? { home: shownScore.h, away: shownScore.a } : null}
          settled={isFinal}
        />
      )}
    </div>
  );
}
