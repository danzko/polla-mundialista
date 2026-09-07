import * as React from 'react';
import { getBonuses, getTeams, getCurrentTournament } from '@/lib/api';
import { BonusPicksForm } from './BonusPicksForm';
import { TrophyMark } from '@/components/shared/brand';
import uclPlayers from '@/lib/players-ucl-2026-27.json';

interface BonusesPageProps {
  params: Promise<{ locale: string }>;
}

export default async function BonusesPage({ params }: BonusesPageProps) {
  const { locale } = await params;
  const es = locale === 'es';

  const [bonuses, teams, tournament] = await Promise.all([
    getBonuses(),
    getTeams(),
    getCurrentTournament(),
  ]);
  const ucl = tournament.kind === 'ucl';

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground select-none flex items-center gap-2">
          <TrophyMark className="h-8 w-8 shrink-0 drop-shadow-[0_0_10px_rgba(246,200,74,0.3)]" />
          {es ? 'Pronósticos Especiales' : 'Tournament Predictions'}
        </h1>
        <p className="text-xs text-muted-foreground font-light mt-1">
          {ucl
            ? (es
                ? `Elige el campeón, el máximo goleador y el jugador de la temporada de la ${tournament.nameEs} para ganar puntos extra.`
                : `Pick the champion, top scorer and player of the season of the ${tournament.nameEn} for bonus points.`)
            : (es
                ? `Elige el campeón y los mejores jugadores del ${tournament.nameEs} para ganar puntos extra.`
                : `Pick the champion and key awards of the ${tournament.nameEn} for bonus points.`)}
        </p>
      </div>

      <BonusPicksForm
        initialBonuses={bonuses}
        teams={teams}
        locale={locale as 'es' | 'en'}
        kind={tournament.kind}
        players={ucl ? (uclPlayers as { n: string; t: string }[]) : undefined}
      />
    </div>
  );
}
