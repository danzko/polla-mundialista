'use client';

import * as React from 'react';
import { ScoreStepper } from './ScoreStepper';
import { PicksStrip } from './PicksStrip';
import { knockoutSlotLabel } from '@/lib/bracket-slots';
import { Flag } from '@/components/shared/Flag';
import { shortTeamName } from '@/lib/team-names';
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
  /** La Fija: this card is the viewer's banker for its matchday. */
  isBanker?: boolean;
  /** Called when the star is tapped (only rendered when provided and the game is open). */
  onBanker?: (matchId: string) => void;
}

/**
 * Compact timeline-feed card. Renders four states off one scoreboard
 * layout: editable (steppers), live (running score + EN VIVO clock),
 * final (score + your result/points), and locked-upcoming (your pick +
 * close time). The contestant pick strip tucks underneath once started.
 */
export function FeedMatchCard({
  match, locale, live, editable, homeScore, awayScore, onChange, picks, myUserId, isBanker = false, onBanker,
}: FeedMatchCardProps) {
  const es = locale === 'es';

  const name = (team: MatchView['homeTeam'], pos: 'home' | 'away') =>
    team
      ? shortTeamName(es ? team.nameEs : team.nameEn)
      : (knockoutSlotLabel(match.matchNumber, pos, locale) ?? (es ? 'Por definir' : 'TBD'));
  const flag = (team: MatchView['homeTeam']) =>
    team
      ? <Flag code={team.code} emoji={team.flagEmoji} logoUrl={team.logoUrl} className={team.logoUrl ? 'inline-block h-5 w-5 object-contain' : 'inline-block h-4 w-auto rounded-[2px] shadow-sm'} />
      : <span>🏳️</span>;

  // Meta label: Grupo A · Jornada 3 · Play-off · Eliminatoria (ida/vuelta)
  const stageLabel = (() => {
    if (match.stage === 'group') return `${es ? 'Grupo' : 'Group'} ${match.groupLabel ?? ''}`;
    if (match.stage === 'league') return es ? `Jornada ${match.matchday ?? ''}` : `Matchday ${match.matchday ?? ''}`;
    const base = match.stage === 'playoff' ? 'Play-off'
      : match.stage === 'r16' ? (es ? 'Octavos' : 'Round of 16')
      : match.stage === 'qf' ? (es ? 'Cuartos' : 'Quarterfinal')
      : match.stage === 'sf' ? (es ? 'Semifinal' : 'Semifinal')
      : match.stage === 'final' ? 'Final'
      : match.stage === 'third_place' ? (es ? '3.er puesto' : '3rd place')
      : (es ? 'Eliminatoria' : 'Knockout');
    const leg = match.leg === 1 ? (es ? ' · ida' : ' · 1st leg') : match.leg === 2 ? (es ? ' · vuelta' : ' · 2nd leg') : '';
    return base + leg;
  })();

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
      return <span className="rounded text-[11px] font-bold uppercase tracking-wide px-1.5 py-0.5 bg-destructive/10 text-destructive border border-destructive/30">{es ? 'anulado' : 'void'}</span>;
    }
    if (isLive) {
      return (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold text-red-300 bg-red-500/15 border border-red-500/40">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          {es ? 'en vivo' : 'live'} {live?.displayClock || ''}
        </span>
      );
    }
    if (isFinal) {
      return <span className="rounded text-[11px] font-bold uppercase px-1.5 py-0.5 bg-secondary/70 text-muted-foreground border border-border/50">{es ? 'fin' : 'FT'}</span>;
    }
    if (editable) {
      return <span className="text-[11px] font-medium text-muted-foreground">{fmtTime(match.kickoffAt)}</span>;
    }
    // locked but not started, or started without data yet
    if (!started) {
      return <span className="rounded text-[11px] font-semibold px-1.5 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/25">{es ? 'cerrado' : 'locked'}</span>;
    }
    return <span className="rounded text-[11px] font-semibold px-1.5 py-0.5 bg-secondary/70 text-muted-foreground border border-border/50">{es ? 'en juego' : 'in play'}</span>;
  })();

  // Your-pick + points sub-row
  const pts = match.pointsEarned;
  const pointsPill =
    pts === null || match.isVoided ? null : (
      <span className={cn(
        'rounded px-1.5 py-0.5 text-[11px] font-bold',
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
        'rounded-2xl border px-3.5 py-3 transition-colors',
        phaseClass,
        isBanker && 'ring-1 ring-amber-400/60 border-amber-400/50',
        match.isVoided && 'opacity-60'
      )}>
        {/* meta row */}
        <div className="mb-2 flex items-center justify-between">
          {match.stage === 'league' && !isLive && !isFinal ? (
            // Inside a matchday section the round label is redundant: use the
            // slot for the thing that matters — is this game picked yet?
            <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider',
              match.myPrediction ? 'text-emerald-400/90' : editable ? 'text-amber-400' : 'text-muted-foreground/70')}>
              <span className={cn('h-1.5 w-1.5 rounded-full', match.myPrediction ? 'bg-emerald-400' : editable ? 'bg-amber-400' : 'bg-muted-foreground/50')} />
              {match.myPrediction ? (es ? 'Pronosticado' : 'Picked') : editable ? (es ? 'Sin pronóstico' : 'No pick yet') : (es ? 'Sin pronóstico' : 'No pick')}
            </span>
          ) : (
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
              {stageLabel}
              {!editable && !isLive && !isFinal && !match.isVoided && (
                <span className="ml-1.5 font-medium normal-case tracking-normal">· {fmtTime(match.kickoffAt)}</span>
              )}
            </span>
          )}
          {badge}
        </div>

        {/* scoreboard row */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex items-center justify-end gap-2 min-w-0 text-[15px] font-semibold">
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
              <span className="text-xs font-semibold uppercase text-muted-foreground/70">vs</span>
            ) : null}
          </div>

          <div className="flex items-center justify-start gap-2 min-w-0 text-[15px] font-semibold">
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

        {/* La Fija: one game per matchday counts double */}
        {match.stage === 'league' && (isBanker || (editable && onBanker)) && (
          <div className="mt-2 flex justify-center">
            {editable && onBanker ? (
              <button
                type="button"
                onClick={() => onBanker(match.id)}
                aria-pressed={isBanker}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-colors',
                  isBanker
                    ? 'border-amber-400/70 bg-amber-400/15 text-amber-300'
                    : 'border-border/60 bg-card/60 text-muted-foreground hover:border-amber-400/50 hover:text-amber-300'
                )}
              >
                <span aria-hidden>{isBanker ? '⭐' : '☆'}</span>
                {isBanker ? (es ? 'La Fija™️ · puntos x2' : 'La Fija™️ · points x2') : (es ? 'Escoger La Fija™️' : 'Pick La Fija™️')}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300">
                ⭐ {es ? 'La Fija™️ · x2' : 'La Fija™️ · x2'}
              </span>
            )}
          </div>
        )}

        {/* your pick + points (non-editable, when you predicted) */}
        {!editable && match.myPrediction && (
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
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
