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
import { submitBonuses } from '@/lib/api';
import { bonusPredictionsSchema } from '@/lib/validation';
import type { BonusView, Team, Locale } from '@/lib/types';
import { Trophy, Award, Medal, Check, AlertCircle, RefreshCw, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BonusPicksFormProps {
  initialBonuses: BonusView;
  teams: Team[];
  locale: Locale;
}

type FormData = z.infer<typeof bonusPredictionsSchema>;

// Pad a saved array to a fixed number of controlled inputs
const padTo = (arr: string[], size: number) => {
  const out = [...arr.slice(0, size)];
  while (out.length < size) out.push('');
  return out;
};

export function BonusPicksForm({ initialBonuses, teams, locale }: BonusPicksFormProps) {
  const t = useTranslations();
  
  const [locked, setLocked] = React.useState(initialBonuses.locked);
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [apiError, setApiError] = React.useState<string | null>(null);

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
      <div className="glass-card p-6 rounded-2xl border border-border/60 flex flex-col items-center text-center space-y-4 shadow-md">
        <CountdownToLock lockAt={initialBonuses.lockAt} onLockChange={handleLockChange} />
        <p className="text-xs text-muted-foreground max-w-sm leading-relaxed font-light">
          {t('bonuses.description')}
        </p>
      </div>

      {/* FORM CONTAINER */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="glass-card rounded-2xl border-border/75 shadow-xl">
          <CardHeader className="pb-4 border-b border-border/40 select-none">
            <CardTitle className="text-xl font-extrabold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-400" />
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
              <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 select-none">
                🏆 {t('bonuses.champion')}
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
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 select-none"
                >
                  <Award className="h-4 w-4 text-amber-500" />
                  {t('bonuses.topScorer')}
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
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 select-none"
                >
                  <Star className="h-4 w-4 text-emerald-500" />
                  {t('bonuses.bestPlayer')}
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
          <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/40 bg-slate-950/20 py-4 select-none">
            
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
    </div>
  );
}
