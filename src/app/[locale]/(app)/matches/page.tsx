import * as React from 'react';
import { getMatches, getTeams } from '@/lib/api';
import { MatchesFilterView } from './MatchesFilterView';

interface MatchesPageProps {
  params: Promise<{ locale: string }>;
}

export default async function MatchesPage({ params }: MatchesPageProps) {
  const { locale } = await params;
  
  // Fetch initial fixtures and teams on the server
  const [matches, teams] = await Promise.all([
    getMatches(),
    getTeams(),
  ]);

  return (
    <div className="space-y-6 py-4">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground select-none">
          ⚽️ {locale === 'es' ? 'Calendario de Partidos' : 'Match Schedule'}
        </h1>
        <p className="text-xs text-muted-foreground font-light mt-1">
          {locale === 'es'
            ? 'Predice marcadores exactos y haz seguimiento a los partidos del Mundial.'
            : 'Predict exact scores and follow matches throughout the World Cup.'}
        </p>
      </div>

      {/* Filter and Cards view */}
      <MatchesFilterView initialMatches={matches} locale={locale as any} />
    </div>
  );
}
