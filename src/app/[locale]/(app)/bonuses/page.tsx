import * as React from 'react';
import { getBonuses, getTeams } from '@/lib/api';
import { BonusPicksForm } from './BonusPicksForm';
import { TrophyMark } from '@/components/shared/brand';

interface BonusesPageProps {
  params: Promise<{ locale: string }>;
}

export default async function BonusesPage({ params }: BonusesPageProps) {
  const { locale } = await params;

  // Fetch teams and existing bonus picks on the server
  const [bonuses, teams] = await Promise.all([
    getBonuses(),
    getTeams(),
  ]);

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground select-none flex items-center gap-2">
          <TrophyMark className="h-8 w-8 shrink-0 drop-shadow-[0_0_10px_rgba(246,200,74,0.3)]" />
          {locale === 'es' ? 'Pronósticos Especiales' : 'Tournament Predictions'}
        </h1>
        <p className="text-xs text-muted-foreground font-light mt-1">
          {locale === 'es'
            ? 'Elige los campeones y mejores jugadores del Mundial para ganar puntos extra.'
            : 'Predict final positions and key awards to score bonus points.'}
        </p>
      </div>

      {/* Bonus Form view */}
      <BonusPicksForm initialBonuses={bonuses} teams={teams} locale={locale as any} />
    </div>
  );
}
