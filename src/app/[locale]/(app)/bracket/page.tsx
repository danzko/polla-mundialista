import * as React from 'react';
import { getBracket, getLeagueBrackets, getTeams, getBonuses, getCurrentTournament } from '@/lib/api';
import { BracketBoard } from './BracketBoard';
import { TrophyMark } from '@/components/shared/brand';

export const dynamic = 'force-dynamic';

interface BracketPageProps {
  params: Promise<{ locale: string }>;
}

export default async function BracketPage({ params }: BracketPageProps) {
  const { locale } = await params;
  const [bracket, comparison, teams, bonus, tournament] = await Promise.all([
    getBracket(),
    getLeagueBrackets(),
    getTeams(),
    getBonuses(),
    getCurrentTournament(),
  ]);
  const es = locale === 'es';

  // The Champions League bracket only exists once the play-off draw is made
  // (late January): no knockout fixtures yet → explain instead of an empty tree.
  if (tournament.kind !== 'world_cup' && bracket.matches.length === 0) {
    return (
      <div className="py-6 max-w-lg mx-auto">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-6 text-center">
          <TrophyMark className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm font-bold">{es ? 'La Llave aún no se abre' : 'The Bracket is not open yet'}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {es
              ? 'Se arma después del sorteo de los play-offs (finales de enero): play-off, octavos, cuartos, semis y final, a ida y vuelta. Mientras tanto, cada jornada de la fase de liga se predice en Partidos.'
              : 'It opens after the play-off draw (late January): play-off, round of 16, quarters, semis and the final, two legs each. Until then, predict every league-phase matchday in Games.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-2">
      <BracketBoard
        initialBracket={bracket}
        comparison={comparison}
        teams={teams}
        bonus={bonus}
        locale={locale as any}
      />
    </div>
  );
}
