import * as React from 'react';
import { notFound } from 'next/navigation';
import { getLeague, getSessionUser, getLeaderboard, getCurrentTournament } from '@/lib/api';
import { LeagueView } from './LeagueView';
import type { Locale } from '@/lib/types';

interface LeagueDetailPageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default async function LeagueDetailPage({ params }: LeagueDetailPageProps) {
  const { id, locale } = await params;
  const [league, currentUser, leaderboardData, tournament] = await Promise.all([
    getLeague(id),
    getSessionUser(),
    getLeaderboard(id),
    getCurrentTournament(),
  ]);
  if (!league) notFound();

  return (
    <LeagueView
      league={league}
      locale={locale as Locale}
      currentUserId={currentUser?.id || ''}
      leaderboardData={leaderboardData}
      kind={tournament.kind}
    />
  );
}
