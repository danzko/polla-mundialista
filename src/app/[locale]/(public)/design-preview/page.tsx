import * as React from 'react';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/shared/AppShell';
import { DashboardView } from '@/app/[locale]/(app)/dashboard/DashboardView';
import { MatchesFilterView } from '@/app/[locale]/(app)/matches/MatchesFilterView';
import { MOCK_HUB, MOCK_LEAGUES, MOCK_MATCHES, MOCK_LEADERBOARD, MOCK_STATS, MOCK_BOARD, MOCK_BONUS, MOCK_TEAMS, MOCK_PLAYERS, MOCK_LEAGUE_DETAIL } from '@/lib/dev/mock-ucl';
import { LeaderboardScreen } from '@/app/[locale]/(app)/leaderboard/LeaderboardScreen';
import { LeagueView } from '@/app/[locale]/(app)/leagues/[id]/LeagueView';
import { BracketPreview } from '@/app/[locale]/(app)/bracket/BracketPreview';
import { BonusPicksForm } from '@/app/[locale]/(app)/bonuses/BonusPicksForm';
import type { Locale } from '@/lib/types';

/**
 * DEV-ONLY design harness: renders the real screens with mock data and no
 * auth, so the UI can be iterated on visually. 404s outside development.
 *   /es/design-preview?screen=home | matches
 */
export const dynamic = 'force-dynamic';

export default async function DesignPreview({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ screen?: string; tab?: string }>;
}) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const { locale } = await params;
  const { screen = 'home', tab } = await searchParams;
  const user = { id: 'b', displayName: 'Danny', preferredLanguage: locale as Locale, isSuperadmin: true, onboarded: true, nameChangeUsed: false };

  return (
    <AppShell user={user} theme="ucl">
      {screen === 'matches' ? (
        <MatchesFilterView initialMatches={MOCK_MATCHES} locale={locale as Locale} myUserId="b" />
      ) : screen === 'tabla' ? (
        <LeaderboardScreen data={MOCK_LEADERBOARD} locale={locale as Locale} stats={MOCK_STATS} kind="ucl" board={MOCK_BOARD} initialTab={(tab as any) ?? 'standings'} />
      ) : screen === 'league' ? (
        <LeagueView league={MOCK_LEAGUE_DETAIL} locale={locale as Locale} currentUserId="b" leaderboardData={MOCK_LEADERBOARD} kind="ucl" />
      ) : screen === 'llave' ? (
        <BracketPreview locale={locale as Locale} />
      ) : screen === 'bonos' ? (
        <BonusPicksForm initialBonuses={MOCK_BONUS} teams={MOCK_TEAMS} locale={locale as Locale} kind="ucl" players={MOCK_PLAYERS} />
      ) : (
        <DashboardView leagues={MOCK_LEAGUES} hub={MOCK_HUB} userName="Danny" locale={locale as Locale} />
      )}
    </AppShell>
  );
}
