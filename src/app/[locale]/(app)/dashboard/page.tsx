'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { getDashboard, getSessionUser, getSeasonHub } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Plus, UserPlus, Users, Award, Calendar, Trophy, ChevronRight } from 'lucide-react';
import { BallMark, TrophyMark } from '@/components/shared/brand';
import { Flag } from '@/components/shared/Flag';
import { SeasonPass } from '@/components/shared/SeasonPass';
import type { LeagueSummary, SeasonHub, Locale } from '@/lib/types';
import { cn } from '@/lib/utils';

const MEDAL = ['🥇', '🥈', '🥉'];

export default function DashboardPage() {
  const t = useTranslations();
  const pathname = usePathname();
  const currentLocale = (pathname.split('/')[1] || 'es') as Locale;
  const es = currentLocale === 'es';
  const basePath = `/${currentLocale}`;

  const [leagues, setLeagues] = React.useState<LeagueSummary[]>([]);
  const [hub, setHub] = React.useState<SeasonHub | null>(null);
  const [userName, setUserName] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadDashboardData() {
      try {
        const [user, dashboardLeagues, seasonHub] = await Promise.all([
          getSessionUser(),
          getDashboard(),
          getSeasonHub(currentLocale),
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
    loadDashboardData();
  }, [currentLocale]);

  // Format rank badges (podium finishes get nice colors)
  const getRankBadge = (rank: number | null) => {
    if (rank === null) return null;
    let style = 'bg-secondary text-foreground';
    let decoration = null;
    if (rank === 1) { style = 'bg-amber-500/10 border border-amber-500/30 text-amber-400 font-extrabold glow-gold'; decoration = '🥇'; }
    else if (rank === 2) { style = 'bg-slate-300/10 border border-slate-300/30 text-slate-300 font-bold'; decoration = '🥈'; }
    else if (rank === 3) { style = 'bg-amber-700/10 border border-amber-700/30 text-amber-600 font-semibold'; decoration = '🥉'; }
    return (
      <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold', style)}>
        {decoration} {t('dashboard.rank', { rank })}
      </span>
    );
  };

  // "Jornada 3 · mar 20 – mié 21 oct" in ET, the clock every lock runs on.
  const fmtRange = (a: string, b: string) => {
    const f = (iso: string, o: Intl.DateTimeFormatOptions) =>
      new Date(iso).toLocaleDateString(es ? 'es-CO' : 'en-US', { timeZone: 'America/New_York', ...o }).replace(/[.,]/g, '').replace(/\bde\b/g, '').replace(/\s+/g, ' ').trim();
    const da = f(a, { weekday: 'short', day: 'numeric', month: 'short' });
    const db = f(b, { weekday: 'short', day: 'numeric', month: 'short' });
    return da === db ? da : `${da} – ${db}`;
  };
  const untilLabel = (iso: string) => {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return es ? 'en curso' : 'in progress';
    const d = Math.floor(ms / 86_400_000), h = Math.floor((ms % 86_400_000) / 3_600_000);
    if (d >= 1) return es ? `en ${d} d ${h} h` : `in ${d}d ${h}h`;
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return es ? `en ${h} h ${m} min` : `in ${h}h ${m}m`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 py-6">
        <div className="h-10 w-48 bg-slate-800 rounded-lg animate-pulse"></div>
        <div className="h-40 bg-slate-800 rounded-2xl animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-44 bg-slate-800 rounded-2xl animate-pulse"></div>
          <div className="h-44 bg-slate-800 rounded-2xl animate-pulse"></div>
        </div>
      </div>
    );
  }

  const tournament = hub?.tournament ?? null;
  const next = hub?.nextMatchday ?? null;
  const archived = tournament?.status === 'archived';

  return (
    <div className="space-y-8 py-4">
      {/* ENROLLMENT MOMENT — once per new season */}
      {hub && leagues.length > 0 && <SeasonPass hub={hub} userName={userName} locale={currentLocale} />}

      {/* HEADER SECTION — the Champions League gets the night-sky plaque */}
      <div className={cn(
        'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4',
        tournament?.kind === 'ucl' && 'ucl-sky rounded-2xl border border-white/10 p-5 sm:p-6 shadow-[0_20px_60px_-30px_rgba(94,124,255,.6)]'
      )}>
        <div>
          {tournament?.kind === 'ucl' && (
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[.35em] text-blue-200/80">
              {es ? 'Temporada 2026-27' : '2026-27 season'}
            </div>
          )}
          <h1
            className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2"
            style={tournament?.kind === 'ucl' ? {
              fontFamily: '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,ui-serif,serif',
              background: 'linear-gradient(180deg,#FFFFFF 0%,#DCE4FF 55%,#9DB2FF 100%)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            } : undefined}
          >
            <BallMark className="h-7 w-7 shrink-0" />
            {tournament ? (es ? tournament.nameEs : tournament.nameEn) : t('dashboard.title')}
          </h1>
          <p className="text-sm text-muted-foreground font-light mt-1">
            {es ? `¡Hola de nuevo, ${userName}!` : `Hello, ${userName}!`}{' '}
            {archived
              ? (es ? 'Este torneo ya terminó.' : 'This tournament is over.')
              : tournament?.status === 'upcoming'
                ? (es ? 'La temporada está por empezar.' : 'The season is about to start.')
                : (es ? 'Listo para predecir.' : 'Ready to make predictions.')}
          </p>
        </div>

        {leagues.length > 0 && (
          <div className="flex gap-2.5 w-full sm:w-auto">
            <Button asChild variant="outline" size="sm" className="rounded-xl flex-1 sm:flex-initial text-xs gap-1.5 border-primary/20 bg-card hover:bg-primary/10">
              <Link href={`${basePath}/leagues/join`}>
                <UserPlus className="h-4 w-4" />
                {t('dashboard.joinBtn')}
              </Link>
            </Button>
            <Button asChild size="sm" className="rounded-xl flex-1 sm:flex-initial text-xs gap-1.5">
              <Link href={`${basePath}/leagues/new`}>
                <Plus className="h-4 w-4" />
                {t('dashboard.createBtn')}
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* NEXT ROUND — the weekly ritual */}
      {leagues.length > 0 && next && (
        <Card className="rounded-2xl border border-primary/30 bg-primary/[0.06] glow-green p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 shrink-0 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <Calendar className="h-6 w-6" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-primary">
                {next.liveCount > 0
                  ? (es ? `${next.liveCount} en vivo ahora` : `${next.liveCount} live now`)
                  : (es ? 'Próxima jornada' : 'Next round')}
              </div>
              <h4 className="text-lg font-extrabold leading-tight">
                {next.label}
                <span className="ml-2 text-sm font-medium text-muted-foreground">{fmtRange(next.firstKickoff, next.lastKickoff)}</span>
              </h4>
              <p className="text-xs text-muted-foreground">
                {es ? 'Primer pitazo' : 'First kickoff'} {untilLabel(next.firstKickoff)} ·{' '}
                <span className={cn('font-semibold', next.saved === next.total ? 'text-emerald-400' : 'text-amber-400')}>
                  {next.saved}/{next.total} {es ? 'pronósticos guardados' : 'picks saved'}
                </span>
                {next.open < next.total && next.open > 0 && (
                  <span className="text-muted-foreground"> · {next.open} {es ? 'aún abiertos' : 'still open'}</span>
                )}
              </p>
            </div>
          </div>
          <Button asChild className="rounded-xl font-bold py-5 w-full md:w-auto px-6 shrink-0">
            <Link href={`${basePath}/matches`}>
              🔮 {next.saved === next.total ? (es ? 'Revisar mis picks' : 'Review my picks') : t('league.predictBtn')}
            </Link>
          </Button>
        </Card>
      )}

      {/* MAIN CONTENT */}
      {leagues.length === 0 ? (
        // EMPTY STATE
        <div className="flex flex-col items-center justify-center p-8 text-center glass-card border border-border/60 rounded-3xl min-h-[350px] space-y-6">
          <div className="h-16 w-16 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center animate-pulse">
            <TrophyMark className="h-9 w-9" />
          </div>
          <div className="space-y-2 max-w-sm">
            <h3 className="text-xl font-extrabold tracking-tight">
              {es ? 'Comienza tu Polla' : 'Start Your Prediction Pool'}
            </h3>
            <p className="text-sm text-muted-foreground font-light leading-relaxed">
              {t('dashboard.noLeagues')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs justify-center pt-2">
            <Button asChild variant="outline" className="w-full rounded-xl font-bold py-5 border-primary/20 bg-card hover:bg-primary/10">
              <Link href={`${basePath}/leagues/join`}>
                <UserPlus className="h-4.5 w-4.5 mr-2" />
                {t('dashboard.joinBtn')}
              </Link>
            </Button>
            <Button asChild className="w-full rounded-xl font-bold py-5">
              <Link href={`${basePath}/leagues/new`}>
                <Plus className="h-4.5 w-4.5 mr-2" />
                {t('dashboard.createBtn')}
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        // LEAGUES CARDS GRID
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {leagues.map((league) => (
            <Link key={league.id} href={`${basePath}/leagues/${league.id}`} className="group block">
              <Card className="glass-card hover:border-primary/40 transition-all duration-300 h-full flex flex-col justify-between hover:-translate-y-1 relative overflow-hidden group-hover:shadow-lg group-hover:shadow-primary/5">
                {league.isAdmin && (
                  <div className="absolute top-0 right-0 bg-primary/10 border-l border-b border-primary/20 text-primary text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-bl-lg">
                    {t('common.admin')}
                  </div>
                )}
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-extrabold tracking-tight pr-12 group-hover:text-primary transition-colors">
                    {league.name}
                  </CardTitle>
                  <CardDescription className="text-xs font-semibold font-mono tracking-wider text-muted-foreground uppercase flex items-center gap-1 select-none">
                    <span>{es ? 'Código:' : 'Code:'}</span>
                    <span className="text-foreground">{league.inviteCode}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="flex items-center gap-4 text-sm font-medium">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{t('dashboard.members', { count: league.memberCount })}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-primary">
                      <Award className="h-4 w-4" />
                      <span className="font-extrabold">{t('dashboard.points', { points: league.myPoints })}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-border/30 bg-slate-950/20 pt-3 pb-3 flex items-center justify-between">
                  {getRankBadge(league.myRank)}
                  <span className="text-xs font-bold text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all flex items-center gap-1">
                    {es ? 'Ver posiciones' : 'View standings'} →
                  </span>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* HALL OF FAME — titles accumulate season after season */}
      {hub && hub.honors.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-amber-300/90 flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              {es ? 'Salón de la Fama' : 'Hall of Fame'}
            </h2>
            <Link href={`${basePath}/hall`} className="inline-flex items-center gap-1 text-xs font-bold text-primary">
              {es ? 'Ver todo' : 'View all'} <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hub.honors.map((h) => (
              <Link key={h.tournament.id} href={`${basePath}/hall`} className="block rounded-2xl border border-amber-500/30 bg-[#0C111C] p-4 hover:border-amber-400/60 transition-colors"
                style={{ background: 'radial-gradient(420px 160px at 50% -30%, rgba(242,196,82,.18), transparent 65%), #0C111C' }}>
                <div className="text-[10px] font-semibold uppercase tracking-[.3em] text-amber-200/80">
                  {es ? h.tournament.nameEs : h.tournament.nameEn}
                </div>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{es ? 'Campeón' : 'Champion'}</div>
                    <div className="truncate text-xl font-bold" style={{ fontFamily: '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,ui-serif,serif', color: '#F4D488' }}>
                      🏆 {h.podium[0]?.displayName ?? '—'}
                    </div>
                  </div>
                  {h.championCode && (
                    <div className="shrink-0 text-right text-[10px] text-muted-foreground">
                      <Flag code={h.championCode} emoji={h.championFlagEmoji ?? ''} logoUrl={h.championLogoUrl} className="inline-block h-5 w-auto rounded-[2px]" />
                      <div className="mt-0.5">{h.championName}</div>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  {h.podium.slice(1).map((p, i) => (
                    <span key={p.userId}>{MEDAL[i + 1]} {p.displayName}</span>
                  ))}
                  {h.myRank != null && (
                    <span className={cn('ml-auto font-bold', h.myRank <= 3 ? 'text-amber-300' : 'text-foreground')}>
                      {es ? 'Tú' : 'You'}: #{h.myRank} · {h.myPoints} pts
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
