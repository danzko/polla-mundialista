import * as React from 'react';
import { getLeaderboard, getStats, getCurrentTournament } from '@/lib/api';
import { LeaderboardScreen } from './LeaderboardScreen';
import type { Locale } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface LeaderboardPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ league?: string }>;
}

export default async function LeaderboardPage({ params, searchParams }: LeaderboardPageProps) {
  const { locale } = await params;
  const { league } = await searchParams;
  const [data, stats, tournament] = await Promise.all([
    getLeaderboard(league),
    getStats(league, locale as Locale),
    getCurrentTournament(),
  ]);

  return (
    <div className="py-2">
      <LeaderboardScreen data={data} locale={locale as Locale} stats={stats} kind={tournament.kind} />
    </div>
  );
}
