'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { ScoreStepper } from './ScoreStepper';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { MatchView, Locale } from '@/lib/types';

interface MatchCardProps {
  match: MatchView;
  locale: Locale;
  homeScore: number;
  awayScore: number;
  onChange?: (matchId: string, homeScore: number, awayScore: number) => void;
}

export function MatchCard({ match, locale, homeScore, awayScore, onChange }: MatchCardProps) {
  const t = useTranslations();

  // Format kickoff time
  const formatKickoff = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString(locale === 'es' ? 'es-ES' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: locale !== 'es',
    });
  };

  // Helper for TBD team names
  const getTeamName = (team: typeof match.homeTeam, position: 'home' | 'away') => {
    if (team) {
      return locale === 'es' ? team.nameEs : team.nameEn;
    }
    
    // Estimate source matches for placeholders
    const matchNumber = match.matchNumber;
    if (matchNumber === 103) {
      return locale === 'es' ? 'Perdedor Semifinal' : 'Loser Semifinal';
    }
    if (matchNumber === 104) {
      return locale === 'es' ? 'Subcampeón/Ganador SF' : 'Finalist (TBD)';
    }
    
    // Default placeholders
    const sourceNumber = matchNumber > 96 
      ? 80 + (matchNumber - 96) * 2 // approximation for SF/QF
      : 48 + (matchNumber - 80) * 2; // approximation for R16/R32
      
    return locale === 'es' 
      ? `Ganador P${sourceNumber - (position === 'home' ? 1 : 0)}`
      : `Winner M${sourceNumber - (position === 'home' ? 1 : 0)}`;
  };

  // Stage label translation
  const getStageLabel = () => {
    if (match.stage === 'group') {
      return `${t('matches.stageFilter')}: Group ${match.groupLabel || ''}`;
    }
    const stages: Record<string, string> = {
      r32: 'R32',
      r16: 'R16',
      qf: 'QF',
      sf: 'SF',
      third_place: locale === 'es' ? '3er Puesto' : '3rd Place',
      final: 'Final',
    };
    return stages[match.stage] || match.stage.toUpperCase();
  };

  // Determine scoring tag styling and messages
  const renderPointsTag = () => {
    if (match.pointsEarned === null || match.isVoided) return null;

    let tagColor = 'bg-slate-800 text-slate-400 border border-slate-700/60';
    let text = t('matches.wrongResult');

    if (match.pointsEarned > 2) {
      tagColor = 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-extrabold shadow-sm shadow-emerald-500/5';
      text = t('matches.exactMatch', { count: match.pointsEarned });
    } else if (match.pointsEarned > 0) {
      tagColor = 'bg-blue-500/10 border border-blue-500/30 text-blue-400 font-semibold';
      text = t('matches.correctResult', { count: match.pointsEarned });
    }

    return (
      <div className="flex flex-col items-center justify-center mt-2.5">
        <span className={cn("px-2.5 py-1 rounded-full text-xs transition-all", tagColor)}>
          {text}
        </span>
      </div>
    );
  };

  const isPredictable = match.homeTeam !== null && match.awayTeam !== null && !match.locked && !match.isVoided;
  const showMultiplier = match.stage !== 'group';

  return (
    <Card className={cn(
      "glass-card overflow-hidden transition-all duration-300 hover:border-border/80",
      isPredictable && "hover:-translate-y-0.5",
      match.locked && "opacity-95"
    )}>
      <CardContent className="p-4 flex flex-col justify-between h-full">
        {/* TOP META ROW */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3 pb-2 border-b border-border/40">
          <span className="font-extrabold uppercase bg-secondary/80 text-foreground px-2 py-0.5 rounded-md tracking-wider">
            {getStageLabel()}
          </span>

          <div className="flex items-center gap-1.5 font-medium">
            {match.isVoided ? (
              <span className="text-destructive font-bold uppercase tracking-wider">{t('matches.voided')}</span>
            ) : match.locked ? (
              <span className="flex items-center gap-1 text-amber-500 font-bold uppercase tracking-wider">
                <Lock className="h-3 w-3" />
                {t('matches.locked')}
              </span>
            ) : (
              <span className="text-primary-foreground/90 font-medium">
                {formatKickoff(match.kickoffAt)}
              </span>
            )}
          </div>
        </div>

        {/* ROW 1: TEAMS (Home | VS | Away) */}
        <div className="grid grid-cols-7 items-center gap-2 py-2">
          {/* HOME TEAM */}
          <div className="col-span-3 flex flex-col items-center justify-center text-center">
            <span className="text-3xl mb-1 filter drop-shadow-sm select-none">
              {match.homeTeam ? match.homeTeam.flagEmoji : '❓'}
            </span>
            <span className="text-xs font-bold leading-tight line-clamp-1 max-w-[100px] md:max-w-full">
              {getTeamName(match.homeTeam, 'home')}
            </span>
            {match.homeTeam && (
              <span className="text-[10px] font-extrabold text-muted-foreground uppercase mt-0.5 tracking-widest">
                {match.homeTeam.code}
              </span>
            )}
          </div>

          {/* VS */}
          <div className="col-span-1 flex flex-col items-center justify-center">
            <span className="text-xs font-extrabold text-muted-foreground select-none uppercase tracking-widest">VS</span>
          </div>

          {/* AWAY TEAM */}
          <div className="col-span-3 flex flex-col items-center justify-center text-center">
            <span className="text-3xl mb-1 filter drop-shadow-sm select-none">
              {match.awayTeam ? match.awayTeam.flagEmoji : '❓'}
            </span>
            <span className="text-xs font-bold leading-tight line-clamp-1 max-w-[100px] md:max-w-full">
              {getTeamName(match.awayTeam, 'away')}
            </span>
            {match.awayTeam && (
              <span className="text-[10px] font-extrabold text-muted-foreground uppercase mt-0.5 tracking-widest">
                {match.awayTeam.code}
              </span>
            )}
          </div>
        </div>

        {/* ROW 2: STEPPERS (Centered and Roomy) */}
        <div className="flex flex-col items-center justify-center gap-2 mt-3 pt-2 border-t border-border/20">
          <div className="flex items-center gap-4">
            <ScoreStepper
              value={homeScore}
              onChange={(val) => onChange?.(match.id, val, awayScore)}
              disabled={!isPredictable}
            />

            <span className="text-xs font-extrabold text-muted-foreground select-none uppercase tracking-widest">-</span>

            <ScoreStepper
              value={awayScore}
              onChange={(val) => onChange?.(match.id, homeScore, val)}
              disabled={!isPredictable}
            />
          </div>

          {/* KNOCKOUT MULTIPLIER INDICATOR */}
          {showMultiplier && (
            <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest scale-95 select-none">
              {t('matches.knockoutMultiplier')}
            </span>
          )}
        </div>

        {/* BOTTOM METADATA / STATUS */}
        <div className="mt-2 text-center">
          {/* Result recorded banner */}
          {match.result && (
            <div className="text-[11px] text-muted-foreground font-semibold flex items-center justify-center gap-1 bg-slate-900/60 py-1 rounded-lg border border-border/40 select-none">
              <span>{t('matches.stageFilter')}:</span>
              <span className="text-foreground font-extrabold">
                {match.result.homeScore} - {match.result.awayScore}
              </span>
            </div>
          )}

          {/* Points earned */}
          {renderPointsTag()}
        </div>
      </CardContent>
    </Card>
  );
}
