import * as React from 'react';
import { getBonuses, getTeams } from '@/lib/api';
import { BonusPicksForm } from './BonusPicksForm';

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
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground select-none">
          🏆 {locale === 'es' ? 'Pronósticos Especiales' : 'Tournament Predictions'}
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
