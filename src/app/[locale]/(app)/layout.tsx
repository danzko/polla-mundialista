import * as React from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getSessionUser, listTournaments, getCurrentTournament } from '@/lib/api';
import { AppShell } from '@/components/shared/AppShell';
import { TournamentTabs } from '@/components/shared/TournamentTabs';

interface AppLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AppLayout({ children, params }: AppLayoutProps) {
  const { locale } = await params;
  const user = await getSessionUser();

  // Redirect to login if user session is missing
  if (!user) {
    redirect(`/${locale}/login`);
  }

  // Redirect to onboarding if profile is not completed
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';
  if (!user.onboarded && !pathname.endsWith('/onboarding')) {
    redirect(`/${locale}/onboarding`);
  }

  const [tournaments, current] = await Promise.all([listTournaments(), getCurrentTournament()]);

  return (
    <AppShell user={user} theme={current.kind === 'ucl' ? 'ucl' : 'wc'}>
      {!pathname.endsWith('/onboarding') && (
        <TournamentTabs tournaments={tournaments} current={current} locale={locale as 'es' | 'en'} />
      )}
      {children}
    </AppShell>
  );
}
