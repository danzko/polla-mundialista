'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { TeamPicker } from '@/components/shared/TeamPicker';
import { CountdownToLock } from '@/components/shared/CountdownToLock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    register,
    handleSubmit,
    setValue,
    watch,
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

  // Keep track of values to avoid duplicate picks warnings
  const values = watch();

  const handleLockChange = (isExpired: boolean) => {
    if (isExpired) {
      setLocked(true);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (locked) return;
    
    setSaveStatus('saving');
    setApiError(null);

    // Filter out empty entries before submitting
    const cleanedSemi = data.semifinalists.filter(id => id && id !== '');
    const cleanedScorers = data.topScorerNames.filter(n => n && n.trim() !== '');
    const cleanedPlayers = data.bestPlayerNames.filter(n => n && n.trim() !== '');

    const result = await submitBonuses({
      championTeamId: data.championTeamId,
      runnerUpTeamId: data.runnerUpTeamId,
      thirdPlaceTeamId: data.thirdPlaceTeamId,
      semifinalists: cleanedSemi,
      topScorerNames: cleanedScorers,
      bestPlayerNames: cleanedPlayers,
    });

    if (result.ok) {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } else {
      setSaveStatus('error');
      setApiError(result.error);
    }
  };

  // Helper to check if a team is already selected elsewhere to show styling warnings
  const getSelectionsCount = (teamId: string | null) => {
    if (!teamId) return 0;
    let count = 0;
    if (values.championTeamId === teamId) count++;
    if (values.runnerUpTeamId === teamId) count++;
    if (values.thirdPlaceTeamId === teamId) count++;
    if (values.semifinalists?.includes(teamId)) count += values.semifinalists.filter(id => id === teamId).length;
    return count;
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
              {locale === 'es' ? 'Predecir Posiciones Finales' : 'Predict Final Positions'}
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6 space-y-8">
            
            {apiError && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3.5 text-xs font-semibold text-destructive text-center">
                ⚠️ {apiError}
              </div>
            )}

            {/* PODIUM GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Champion */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 select-none">
                  🥇 {t('bonuses.champion')}
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

              {/* Runner-up */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 select-none">
                  🥈 {t('bonuses.runnerUp')}
                </label>
                <Controller
                  name="runnerUpTeamId"
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

              {/* 3rd Place */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5 select-none">
                  🥉 {t('bonuses.thirdPlace')}
                </label>
                <Controller
                  name="thirdPlaceTeamId"
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

            </div>

            {/* SEMIFINALISTS */}
            <div className="space-y-3 pt-4 border-t border-border/40">
              <label className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 select-none">
                🏅 {t('bonuses.semifinalists')}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="space-y-1">
                    <Controller
                      name={`semifinalists.${index}`}
                      control={control}
                      render={({ field }) => (
                        <TeamPicker
                          teams={teams}
                          value={field.value || null}
                          onChange={(val) => {
                            const newSemi = [...(values.semifinalists || [])];
                            newSemi[index] = val || '';
                            setValue('semifinalists', newSemi as any);
                          }}
                          locale={locale}
                          disabled={locked}
                          placeholder={t('bonuses.emptyTeamOption')}
                        />
                      )}
                    />
                  </div>
                ))}
              </div>
              {errors.semifinalists && (
                <p className="text-xs text-destructive font-medium mt-1">
                  {errors.semifinalists.message}
                </p>
              )}
            </div>

            {/* AWARDS: 3 ranked scorers + 3 ranked best players (Excel parity) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/40">

              {/* Golden / Silver / Bronze Boot */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 select-none">
                  <Award className="h-4 w-4 text-amber-500" />
                  {t('bonuses.topScorersTitle')}
                </label>
                {([0, 1, 2] as const).map((index) => (
                  <div key={index} className="space-y-1">
                    <label
                      htmlFor={`topScorerNames-${index}`}
                      className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 select-none"
                    >
                      {t(`bonuses.boot${index}`)}
                    </label>
                    <Controller
                      name={`topScorerNames.${index}`}
                      control={control}
                      render={({ field }) => (
                        <PlayerPicker
                          id={`topScorerNames-${index}`}
                          value={field.value || ''}
                          onChange={field.onChange}
                          disabled={locked}
                          placeholder={t('bonuses.playerPlaceholder')}
                        />
                      )}
                    />
                    {errors.topScorerNames?.[index] && (
                      <p className="text-xs text-destructive font-medium mt-1">
                        {errors.topScorerNames[index]?.message}
                      </p>
                    )}
                  </div>
                ))}
                {typeof errors.topScorerNames?.message === 'string' && (
                  <p className="text-xs text-destructive font-medium mt-1">
                    {errors.topScorerNames.message}
                  </p>
                )}
              </div>

              {/* Golden / Silver / Bronze Ball */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 select-none">
                  <Star className="h-4 w-4 text-emerald-500" />
                  {t('bonuses.bestPlayersTitle')}
                </label>
                {([0, 1, 2] as const).map((index) => (
                  <div key={index} className="space-y-1">
                    <label
                      htmlFor={`bestPlayerNames-${index}`}
                      className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 select-none"
                    >
                      {t(`bonuses.ball${index}`)}
                    </label>
                    <Controller
                      name={`bestPlayerNames.${index}`}
                      control={control}
                      render={({ field }) => (
                        <PlayerPicker
                          id={`bestPlayerNames-${index}`}
                          value={field.value || ''}
                          onChange={field.onChange}
                          disabled={locked}
                          placeholder={t('bonuses.playerPlaceholder')}
                        />
                      )}
                    />
                    {errors.bestPlayerNames?.[index] && (
                      <p className="text-xs text-destructive font-medium mt-1">
                        {errors.bestPlayerNames[index]?.message}
                      </p>
                    )}
                  </div>
                ))}
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
