import * as React from 'react';
import { getBracket, getLeagueBrackets, getTeams, getBonuses, getCurrentTournament } from '@/lib/api';
import { BracketBoard } from './BracketBoard';
import { BracketPreview } from './BracketPreview';

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
  // The Champions League bracket only exists once the play-off draw is made
  // (late January): no knockout fixtures yet → explain instead of an empty tree.
  if (tournament.kind !== 'world_cup' && bracket.matches.length === 0) {
    return <BracketPreview locale={locale as 'es' | 'en'} />;
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
