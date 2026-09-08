import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LeagueInvite } from '@/components/shared/LeagueInvite';
import { ArrowLeft, Calendar, Users } from 'lucide-react';
import { LeagueTabs } from './LeagueTabs';
import type { Locale, LeagueDetail, LeaderboardData } from '@/lib/types';

/** League detail, presentational: header + tabs. Data comes from the page (or the dev harness). */
export function LeagueView({ league, locale, currentUserId, leaderboardData, kind }: {
  league: LeagueDetail;
  locale: Locale;
  currentUserId: string;
  leaderboardData?: LeaderboardData | null;
  kind?: 'world_cup' | 'ucl';
}) {
  const es = locale === 'es';
  const basePath = `/${locale}`;
  return (
    <div className="space-y-5">
      <Link
        href={`${basePath}/dashboard`}
        className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {es ? 'Inicio' : 'Home'}
      </Link>

      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight [text-wrap:balance]">{league.name}</h1>
        <div className="flex items-center justify-between gap-3">
          <p className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground">
            <Users className="h-4 w-4 shrink-0" />
            {es ? `${league.members.length} participantes` : `${league.members.length} players`}
          </p>
        <div className="flex shrink-0 items-center gap-2">
          <LeagueInvite code={league.inviteCode} leagueName={league.name} locale={locale} />
          <Button asChild size="sm" className="h-10 rounded-xl gap-1.5 px-3.5 text-xs font-bold">
            <Link href={`${basePath}/matches`}>
              <Calendar className="h-3.5 w-3.5" />
              {es ? 'Predecir' : 'Predict'}
            </Link>
          </Button>
        </div>
        </div>
      </div>

      <LeagueTabs league={league} locale={locale} currentUserId={currentUserId} leaderboardData={leaderboardData} kind={kind} />
    </div>
  );
}
