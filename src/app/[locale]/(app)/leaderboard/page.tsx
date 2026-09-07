import * as React from 'react';
import { getLeaderboard, getStats, getCurrentTournament, getMatchdayBoard } from '@/lib/api';
import { LeaderboardScreen } from './LeaderboardScreen';
import type { Locale } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface LeaderboardPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ league?: string; md?: string; tab?: string }>;
}

export default async function LeaderboardPage({ params, searchParams }: LeaderboardPageProps) {
  const { locale } = await params;
  const { league, md, tab } = await searchParams;
  const tournament = await getCurrentTournament();
  const [data, stats, board] = await Promise.all([
    getLeaderboard(league),
    getStats(league, locale as Locale),
    tournament.kind === 'ucl' ? getMatchdayBoard(league, md ? Number(md) : undefined) : Promise.resolve(undefined),
  ]);

  return (
    <div className="py-2">
      <LeaderboardScreen
        data={data}
        locale={locale as Locale}
        stats={stats}
        kind={tournament.kind}
        board={board}
        initialTab={tab === 'jornada' || tab === 'stats' ? tab : 'standings'}
      />
    </div>
  );
}
