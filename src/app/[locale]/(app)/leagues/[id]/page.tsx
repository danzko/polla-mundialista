import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLeague, getSessionUser } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { CopyableCode } from '@/components/shared/CopyableCode';
import { ArrowLeft, Calendar, ShieldAlert } from 'lucide-react';
import { LeagueTabs } from './LeagueTabs';

interface LeagueDetailPageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default async function LeagueDetailPage({ params }: LeagueDetailPageProps) {
  const { id, locale } = await params;
  
  // Fetch data on the server
  const [league, currentUser] = await Promise.all([
    getLeague(id),
    getSessionUser(),
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

      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            {league.name}
          </h1>
          <p className="text-xs text-muted-foreground font-light">
            {locale === 'es'
              ? `${league.members.length} participantes activos en la liga`
              : `${league.members.length} active players in the pool`}
          </p>
        </div>

        {/* Invite Code for members / admin */}
        <div className="flex flex-col sm:items-end gap-1.5">
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest block select-none">
            {locale === 'es' ? 'Código de invitación' : 'Invite Code'}
          </span>
          <div className="flex items-center gap-2">
            <CopyableCode code={league.inviteCode} />
            <Button asChild size="sm" className="rounded-xl text-xs gap-1.5 font-bold shadow-sm shadow-primary/10">
              <Link href={`${basePath}/matches`}>
                <Calendar className="h-3.5 w-3.5" />
                {locale === 'es' ? 'Predecir' : 'Predict'}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* TABS CONTAINER (Client component for tab state) */}
      <LeagueTabs league={league} locale={locale as any} currentUserId={currentUser?.id || ''} />
    </div>
  );
}
