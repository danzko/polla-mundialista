'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { getDashboard, getSessionUser } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Plus, UserPlus, Trophy, Users, ShieldAlert, Award, Star } from 'lucide-react';
import type { LeagueSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const t = useTranslations();
  const pathname = usePathname();
  const currentLocale = pathname.split('/')[1] || 'es';
  const basePath = `/${currentLocale}`;

  const [leagues, setLeagues] = React.useState<LeagueSummary[]>([]);
  const [userName, setUserName] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadDashboardData() {
      try {
        const [user, dashboardLeagues] = await Promise.all([
          getSessionUser(),
          getDashboard(),
        ]);
        
        if (user) {
          setUserName(user.displayName);
        }
        setLeagues(dashboardLeagues);
      } catch (err) {
        console.error('Failed to load dashboard data: ', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  // Format rank badges (podium finishes get nice colors)
  const getRankBadge = (rank: number | null) => {
    if (rank === null) return null;
    
    let style = 'bg-secondary text-foreground';
    let decoration = null;

    if (rank === 1) {
      style = 'bg-amber-500/10 border border-amber-500/30 text-amber-400 font-extrabold glow-gold';
      decoration = '🥇';
    } else if (rank === 2) {
      style = 'bg-slate-300/10 border border-slate-300/30 text-slate-300 font-bold';
      decoration = '🥈';
    } else if (rank === 3) {
      style = 'bg-amber-700/10 border border-amber-700/30 text-amber-600 font-semibold';
      decoration = '🥉';
    }

    return (
      <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold", style)}>
        {decoration} {t('dashboard.rank', { rank })}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 py-6">
        <div className="h-10 w-48 bg-slate-800 rounded-lg animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-44 bg-slate-800 rounded-2xl animate-pulse"></div>
          <div className="h-44 bg-slate-800 rounded-2xl animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-4">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            ⚽️ {t('dashboard.title')}
          </h1>
          <p className="text-sm text-muted-foreground font-light mt-1">
            {currentLocale === 'es' ? `¡Hola de nuevo, ${userName}! Listo para predecir.` : `Hello, ${userName}! Ready to make predictions.`}
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

      {/* MAIN CONTENT */}
      {leagues.length === 0 ? (
        // EMPTY STATE
        <div className="flex flex-col items-center justify-center p-8 text-center glass-card border border-border/60 rounded-3xl min-h-[350px] space-y-6">
          <div className="h-16 w-16 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center animate-pulse">
            <Trophy className="h-8 w-8" />
          </div>

          <div className="space-y-2 max-w-sm">
            <h3 className="text-xl font-extrabold tracking-tight">
              {currentLocale === 'es' ? 'Comienza tu Polla' : 'Start Your Prediction Pool'}
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
                
                {/* Admin ribbon */}
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
                    <span>Code:</span>
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
                    {currentLocale === 'es' ? 'Ver posiciones' : 'View standings'} →
                  </span>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* QUICK PREDICTION CTA */}
      {leagues.length > 0 && (
        <Card className="border border-emerald-500/20 bg-emerald-500/5 glow-green rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
            <div className="h-12 w-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <Award className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-foreground">
                {currentLocale === 'es' ? '¡No olvides tus predicciones!' : 'Don\'t forget your predictions!'}
              </h4>
              <p className="text-xs text-muted-foreground font-light">
                {currentLocale === 'es' 
                  ? 'Completa tus pronósticos y picks especiales antes de que empiece el torneo.'
                  : 'Submit your match scores and tournament bonus picks before fixtures begin.'}
              </p>
            </div>
          </div>
          <Button asChild className="rounded-xl font-bold py-5 w-full md:w-auto px-6">
            <Link href={`${basePath}/matches`}>
              🔮 {t('league.predictBtn')}
            </Link>
          </Button>
        </Card>
      )}
    </div>
  );
}
