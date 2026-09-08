'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { TeamPicker } from '@/components/shared/TeamPicker';
import { CountdownToLock } from '@/components/shared/CountdownToLock';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { PlayerPicker } from '@/components/shared/PlayerPicker';
import { Top8Picker } from '@/components/shared/Top8Picker';
import { submitBonuses, submitTop8 } from '@/lib/api';
import { bonusPredictionsSchema } from '@/lib/validation';
import type { BonusView, Team, Locale } from '@/lib/types';
import { Award, Medal, Check, AlertCircle, RefreshCw, Star, Target } from "lucide-react";
import { TrophyMark } from '@/components/shared/brand';
import { cn } from '@/lib/utils';

interface BonusPicksFormProps {
  initialBonuses: BonusView;
  teams: Team[];
  locale: Locale;
  kind?: 'world_cup' | 'ucl';
  players?: { n: string; t: string }[];
}

type FormData = z.infer<typeof bonusPredictionsSchema>;

// Pad a saved array to a fixed number of controlled inputs
const padTo = (arr: string[], size: number) => {
  const out = [...arr.slice(0, size)];
  while (out.length < size) out.push('');
  return out;
};

export function BonusPicksForm({ initialBonuses, teams, locale, kind = 'world_cup', players }: BonusPicksFormProps) {
  const t = useTranslations();

  const es = locale === 'es';
  const ucl = kind === 'ucl';
  // Award names differ per competition: FIFA Golden Boot / Ball vs UEFA's
  // top scorer / Player of the Season.
  const topScorerLabel = ucl ? (es ? 'Máximo goleador (25 pts)' : 'Top scorer (25 pts)') : t('bonuses.topScorer');
  const bestPlayerLabel = ucl ? (es ? 'Jugador de la temporada (25 pts)' : 'Player of the Season (25 pts)') : t('bonuses.bestPlayer');
  const [locked, setLocked] = React.useState(initialBonuses.locked);
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [apiError, setApiError] = React.useState<string | null>(null);

  // Top 8 call (league phase): its own state + save, same lock.
  const [top8, setTop8] = React.useState<string[]>(initialBonuses.top8TeamIds ?? []);
  const [top8Status, setTop8Status] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [top8Error, setTop8Error] = React.useState<string | null>(null);
  const saveTop8 = async () => {
    setTop8Status('saving'); setTop8Error(null);
    const r = await submitTop8({ teamIds: top8 });
    if (r.ok) { setTop8Status('saved'); setTimeout(() => setTop8Status('idle'), 3000); }
    else { setTop8Status('error'); setTop8Error(r.error); }
  };

  // Once locked, the champion pick is the only one with a live signal — is that
  // team still in the tournament or knocked out? Boot/Ball are decided at the
  // very end, so we never show fake point totals mid-tournament.
  const championTeam = teams.find((tm) => tm.id === initialBonuses.championTeamId) ?? null;
  const championAlive = championTeam ? !championTeam.eliminated : false;

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(bonusPredictionsSchema),
    defaultValues: {
      championTeamId: initialBonuses.championTeamId,
      runnerUpTeamId: initialBonuses.runnerUpTeamId,
      thirdPlaceTeamId: initialBonuses.thirdPlaceTeamId,
      semifinalists: padTo(initialBonuses.semifinalists, 4),
      topScorerNames: padTo(initialBonuses.topScorerNames, 3),
      bestPlayerNames: padTo(initialBonuses.bestPlayerNames, 3),
    },
  });

  const handleLockChange = (isExpired: boolean) => {
    if (isExpired) {
      setLocked(true);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (locked) return;
    
    setSaveStatus('saving');
    setApiError(null);

    // Official picks are exactly three: champion + top scorer + best player.
    // Legacy fields (runner-up, third, semis, silver/bronze) are no longer
    // collected and submit empty.
    const topScorer = data.topScorerNames[0]?.trim();
    const bestPlayer = data.bestPlayerNames[0]?.trim();

    const result = await submitBonuses({
      championTeamId: data.championTeamId,
      runnerUpTeamId: null,
      thirdPlaceTeamId: null,
      semifinalists: [],
      topScorerNames: topScorer ? [topScorer] : [],
      bestPlayerNames: bestPlayer ? [bestPlayer] : [],
    });

    if (result.ok) {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } else {
      setSaveStatus('error');
      setApiError(result.error);
    }
  };

  return (
    <div className="space-y-6">

      {/* COUNTDOWN BANNER */}
      <div className="rounded-xl border border-border/60 bg-card px-4 py-3 space-y-1.5">
        <CountdownToLock lockAt={initialBonuses.lockAt} onLockChange={handleLockChange} />
        <p className="text-xs text-muted-foreground leading-relaxed">
          {locked
            ? (es
                ? 'Tus picks están bloqueados. El campeón puntúa solo si gana todo; el goleador y el mejor jugador se definen al terminar el torneo.'
                : 'Your picks are locked. Your champion only scores if they win it all; top scorer and best player are decided when the tournament ends.')
            : t('bonuses.description')}
        </p>
      </div>

      {/* FORM CONTAINER */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="glass-card rounded-2xl border-border/75 shadow-sm">
          <CardHeader className="pb-4 border-b border-border/40 select-none">
            <CardTitle className="text-xl font-extrabold flex items-center gap-2">
              <TrophyMark className="h-5 w-5" />
              {locale === 'es' ? 'Picks del Torneo' : 'Tournament Picks'}
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6 space-y-8">
            
            {apiError && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3.5 text-xs font-semibold text-destructive text-center">
                ⚠️ {apiError}
              </div>
            )}

            {/* THE THREE TOURNAMENT PICKS: champion 50 + top scorer 25 + best player 25 */}
            <div className="space-y-2 md:max-w-md">
              <label className="text-sm font-semibold text-amber-300 flex items-center gap-1.5 select-none">
<TrophyMark className="h-4 w-4 shrink-0" /> {t('bonuses.champion')}
                {locked && (
                  <LockedPill kind={initialBonuses.championTeamId ? (championAlive ? 'alive' : 'out') : 'nopick'} es={es} />
                )}
              </label>
              <Controller
                name="championTeamId"
                control={control}
                render={({ field }) => (
                  <TeamPicker
                    teams={teams}
                    value={field.value}
                    onChange={field.onChange}
                    locale={locale}
                    disabled={locked}
                  />
                )}
              />
            </div>

            {/* AWARDS: 3 ranked scorers + 3 ranked best players (Excel parity) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/40">

              {/* Top scorer (single pick) */}
              <div className="space-y-2">
                <label
                  htmlFor="topScorerNames-0"
                  className="text-sm font-semibold text-foreground flex items-center gap-1.5 select-none"
                >
                  <Award className="h-4 w-4 text-amber-500" />
                  {topScorerLabel}
                  {locked && <LockedPill kind="pending" es={es} />}
                </label>
                <Controller
                  name="topScorerNames.0"
                  control={control}
                  render={({ field }) => (
                    <PlayerPicker
                      id="topScorerNames-0"
                      value={field.value || ''}
                      onChange={field.onChange}
                      disabled={locked}
                      placeholder={t('bonuses.playerPlaceholder')}
                      players={players}
                    />
                  )}
                />
                {typeof errors.topScorerNames?.message === 'string' && (
                  <p className="text-xs text-destructive font-medium mt-1">
                    {errors.topScorerNames.message}
                  </p>
                )}
              </div>

              {/* Best player (single pick) */}
              <div className="space-y-2">
                <label
                  htmlFor="bestPlayerNames-0"
                  className="text-sm font-semibold text-foreground flex items-center gap-1.5 select-none"
                >
                  <Star className="h-4 w-4 text-emerald-500" />
                  {bestPlayerLabel}
                  {locked && <LockedPill kind="pending" es={es} />}
                </label>
                <Controller
                  name="bestPlayerNames.0"
                  control={control}
                  render={({ field }) => (
                    <PlayerPicker
                      id="bestPlayerNames-0"
                      value={field.value || ''}
                      onChange={field.onChange}
                      disabled={locked}
                      placeholder={t('bonuses.playerPlaceholder')}
                      players={players}
                    />
                  )}
                />
                {typeof errors.bestPlayerNames?.message === 'string' && (
                  <p className="text-xs text-destructive font-medium mt-1">
                    {errors.bestPlayerNames.message}
                  </p>
                )}
              </div>

            </div>

          </CardContent>

          {/* FOOTER ACTIONS */}
          <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/40 py-4 select-none">
            
            {/* Status alerts */}
            <div className="min-h-[20px] text-xs font-semibold">
              {saveStatus === 'saving' && (
                <span className="text-primary flex items-center gap-1.5 animate-pulse">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {t('common.saving')}
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <Check className="h-4.5 w-4.5 stroke-[3px]" />
                  {t('common.saved')}
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="text-destructive flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  {apiError || t('errors.generic')}
                </span>
              )}
            </div>

            {/* Save Button (Hide if locked) */}
            {!locked && (
              <Button type="submit" className="w-full sm:w-auto rounded-xl font-bold py-5 px-8">
                {t('bonuses.saveBtn')}
              </Button>
            )}
          </CardFooter>
        </Card>
      </form>
      {/* TOP 8 CALL — league phase only */}
      {ucl && (
        <Card className="glass-card rounded-2xl border-border/75 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40 select-none">
            <CardTitle className="text-lg font-extrabold flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" aria-hidden />{es ? "Top 8 de la fase de liga" : "League-phase Top 8"}
            </CardTitle>
            <CardDescription className="text-xs">
              {es
                ? 'Los 8 clubes que terminan entre los 8 primeros (pasan directo a octavos). +5 por cada acierto, +20 si aciertas los ocho. Se cierra con los demás picks.'
                : 'The 8 clubs that finish in the top 8 (straight to the round of 16). +5 per correct club, +20 for all eight. Locks with the other picks.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {top8Error && (
              <div className="mb-3 rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-xs font-semibold text-destructive text-center">⚠️ {top8Error}</div>
            )}
            <Top8Picker teams={teams} value={top8} onChange={setTop8} locale={locale} disabled={locked} />
          </CardContent>
          {!locked && (
            <CardFooter className="flex items-center justify-between gap-3 border-t border-border/40 py-3.5">
              <span className="text-xs font-semibold">
                {top8Status === 'saving' && <span className="text-primary animate-pulse">{t('common.saving')}</span>}
                {top8Status === 'saved' && <span className="text-emerald-400 inline-flex items-center gap-1"><Check className="h-4 w-4" />{t('common.saved')}</span>}
              </span>
              <Button type="button" onClick={saveTop8} disabled={top8.length !== 8 || top8Status === 'saving'} className="rounded-xl font-bold h-11 px-6">
                {es ? 'Guardar Top 8' : 'Save Top 8'}
              </Button>
            </CardFooter>
          )}
        </Card>
      )}
    </div>
  );
}

// Small status chip shown next to each pick once bonuses are locked.
// Champion: alive / eliminated. Boot & Ball: decided at the tournament's end.
function LockedPill({ kind, es }: { kind: 'alive' | 'out' | 'pending' | 'nopick'; es: boolean }) {
  const map = {
    alive: { cls: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/40', txt: es ? 'Sigue vivo' : 'Still alive' },
    out: { cls: 'bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-400/40', txt: es ? 'Eliminado' : 'Eliminated' },
    pending: { cls: 'bg-secondary/70 text-muted-foreground', txt: es ? 'Se define al final' : 'Decided at the end' },
    nopick: { cls: 'bg-secondary/70 text-muted-foreground', txt: es ? 'Sin pick' : 'No pick' },
  }[kind];
  return (
    <span className={cn('ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold normal-case tracking-normal', map.cls)}>
      {map.txt}
    </span>
  );
}
