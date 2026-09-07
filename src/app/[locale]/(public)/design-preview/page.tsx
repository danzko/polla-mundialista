import * as React from 'react';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/shared/AppShell';
import { DashboardView } from '@/app/[locale]/(app)/dashboard/DashboardView';
import { MatchesFilterView } from '@/app/[locale]/(app)/matches/MatchesFilterView';
import { MOCK_HUB, MOCK_LEAGUES, MOCK_MATCHES } from '@/lib/dev/mock-ucl';
import type { Locale } from '@/lib/types';

/**
 * DEV-ONLY design harness: renders the real screens with mock data and no
 * auth, so the UI can be iterated on visually. 404s outside development.
 *   /es/design-preview?screen=home | matches
 */
export const dynamic = 'force-dynamic';

export default async function DesignPreview({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ screen?: string }>;
}) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const { locale } = await params;
  const { screen = 'home' } = await searchParams;
  const user = { id: 'b', displayName: 'Danny', preferredLanguage: locale as Locale, isSuperadmin: true, onboarded: true, nameChangeUsed: false };

  return (
    <AppShell user={user} theme="ucl">
      {screen === 'matches' ? (
        <MatchesFilterView initialMatches={MOCK_MATCHES} locale={locale as Locale} myUserId="b" />
      ) : (
        <DashboardView leagues={MOCK_LEAGUES} hub={MOCK_HUB} userName="Danny" locale={locale as Locale} />
      )}
    </AppShell>
  );
}
