'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { getDashboard, getSessionUser, getSeasonHub } from '@/lib/api';
import { DashboardView } from './DashboardView';
import type { LeagueSummary, SeasonHub, Locale } from '@/lib/types';

export default function DashboardPage() {
  const pathname = usePathname();
  const locale = (pathname.split('/')[1] || 'es') as Locale;

  const [leagues, setLeagues] = React.useState<LeagueSummary[]>([]);
  const [hub, setHub] = React.useState<SeasonHub | null>(null);
  const [userName, setUserName] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      try {
        const [user, dashboardLeagues, seasonHub] = await Promise.all([
          getSessionUser(),
          getDashboard(),
          getSeasonHub(locale),
        ]);
        if (user) setUserName(user.displayName);
        setLeagues(dashboardLeagues);
        setHub(seasonHub);
      } catch (err) {
        console.error('Failed to load dashboard data: ', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [locale]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-28 rounded-2xl bg-secondary/60 animate-pulse" />
        <div className="h-72 rounded-2xl bg-secondary/60 animate-pulse" />
        <div className="h-44 rounded-2xl bg-secondary/60 animate-pulse" />
      </div>
    );
  }

  return <DashboardView leagues={leagues} hub={hub} userName={userName} locale={locale} />;
}
