import * as React from 'react';
import { getLeaderboard } from '@/lib/api';
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
  const data = await getLeaderboard(league);

  return (
    <div className="py-2">
      <LeaderboardScreen data={data} locale={locale as Locale} />
    </div>
  );
}
