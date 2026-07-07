import * as React from 'react';
import { getBracket, getLeagueBrackets, getTeams, getBonuses } from '@/lib/api';
import { BracketBoardGrand } from './BracketBoardGrand';

export const dynamic = 'force-dynamic';

interface PollaMasterPageProps {
  params: Promise<{ locale: string }>;
}

/**
 * /pollamaster — hidden preview of the "grand" bracket redesign
 * ("El camino a la gloria"). Same data as /bracket, presentation only.
 * Not linked from the nav; once approved, this view replaces the
 * bracket screen's ladder view.
 */
export default async function PollaMasterPage({ params }: PollaMasterPageProps) {
  const { locale } = await params;
  const [bracket, comparison, teams, bonus] = await Promise.all([
    getBracket(),
    getLeagueBrackets(),
    getTeams(),
    getBonuses(),
  ]);

  return (
    <BracketBoardGrand
      initialBracket={bracket}
      comparison={comparison}
      teams={teams}
      bonus={bonus}
      locale={locale as 'es' | 'en'}
    />
  );
}
