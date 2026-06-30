import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLeague, getSessionUser, getLeaderboard } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { LeagueInvite } from '@/components/shared/LeagueInvite';
import { ArrowLeft, Calendar } from 'lucide-react';
import { LeagueTabs } from './LeagueTabs';
import type { Locale } from '@/lib/types';

interface LeagueDetailPageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default async function LeagueDetailPage({ params }: LeagueDetailPageProps) {
  const { id, locale } = await params;
  
  // Fetch data on the server
  const [league, currentUser, leaderboardData] = await Promise.all([
    getLeague(id),
    getSessionUser(),
    getLeaderboard(id),
  ]);

  if (!league) {
    notFound();
  }

  const basePath = `/${locale}`;

  return (
    <div className="space-y-6 py-4">
      {/* Back Button */}
      <Link
        href={`${basePath}/dashboard`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors select-none"
      >
        <ArrowLeft className="h-4 w-4" />
        {locale === 'es' ? 'Volver al Inicio' : 'Back to Dashboard'}
      </Link>

      {/* HEADER SECTION — name + members on the left, invite (code tucked behind
          a tap) and Predict on the right; stays on one tight row on mobile. */}
      <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground truncate">
            {league.name}
          </h1>
          <p className="text-xs text-muted-foreground font-light mt-0.5">
            {locale === 'es'
              ? `${league.members.length} participantes`
              : `${league.members.length} players`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <LeagueInvite code={league.inviteCode} leagueName={league.name} locale={locale as Locale} />
          <Button asChild size="sm" className="rounded-xl text-xs gap-1.5 font-bold shadow-sm shadow-primary/10">
            <Link href={`${basePath}/matches`}>
              <Calendar className="h-3.5 w-3.5" />
              {locale === 'es' ? 'Predecir' : 'Predict'}
            </Link>
          </Button>
        </div>
      </div>

      {/* TABS CONTAINER (Client component for tab state) */}
      <LeagueTabs league={league} locale={locale as any} currentUserId={currentUser?.id || ''} leaderboardData={leaderboardData} />
    </div>
  );
}
