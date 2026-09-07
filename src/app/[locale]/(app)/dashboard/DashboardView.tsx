'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Plus, UserPlus, Users, Trophy, ChevronRight, Lock, Clock } from 'lucide-react';
import { TrophyMark } from '@/components/shared/brand';
import { Flag } from '@/components/shared/Flag';
import { SeasonPass } from '@/components/shared/SeasonPass';
import { shortTeamName } from '@/lib/team-names';
import type { LeagueSummary, SeasonHub, Locale, NextFixture } from '@/lib/types';
import { cn } from '@/lib/utils';

const MEDAL = ['🥇', '🥈', '🥉'];
const SERIF = '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,ui-serif,serif';

/** Home screen, presentational. Data comes from the page (or the dev harness). */
export function DashboardView({ leagues, hub, userName, locale }: {
  leagues: LeagueSummary[];
  hub: SeasonHub | null;
  userName: string;
  locale: Locale;
}) {
  const t = useTranslations();
  const es = locale === 'es';
  const basePath = `/${locale}`;
  const tournament = hub?.tournament ?? null;
  const next = hub?.nextMatchday ?? null;
  const archived = tournament?.status === 'archived';
  const ucl = tournament?.kind === 'ucl';

  const fmtDay = (iso: string, o: Intl.DateTimeFormatOptions) =>
    new Date(iso).toLocaleDateString(es ? 'es-CO' : 'en-US', { timeZone: 'America/New_York', ...o })
      .replace(/[.,]/g, '').replace(/\bde\b/g, '').replace(/\s+/g, ' ').trim();
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(es ? 'es-CO' : 'en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s/g, '').toLowerCase();
  const range = (a: string, b: string) => {
    const da = fmtDay(a, { weekday: 'short', day: 'numeric', month: 'short' });
    const db = fmtDay(b, { weekday: 'short', day: 'numeric', month: 'short' });
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
  const shortName = shortTeamName;

  return (
    <div className="space-y-6">
      {hub && leagues.length > 0 && <SeasonPass hub={hub} userName={userName} locale={locale} />}

      {/* ── SEASON PLAQUE ─────────────────────────────────────── */}
      <section className={cn('rounded-2xl border p-4 sm:p-5', ucl ? 'ucl-sky border-white/10' : 'border-border/60 bg-card')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={cn('text-[11px] font-bold uppercase tracking-[.3em]', ucl ? 'text-blue-200/80' : 'text-primary')}>
              {archived ? (es ? 'Torneo terminado' : 'Tournament over') : (es ? 'Temporada 2026-27' : '2026-27 season')}
            </div>
            <h1
              className="mt-1 text-[26px] sm:text-3xl font-bold leading-none"
              style={ucl ? { fontFamily: SERIF, background: 'linear-gradient(180deg,#FFFFFF 0%,#DCE4FF 55%,#9DB2FF 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : undefined}
            >
              {tournament ? (es ? tournament.nameEs : tournament.nameEn) : t('dashboard.title')}
            </h1>
            <p className={cn('mt-1.5 text-sm', ucl ? 'text-blue-100/70' : 'text-muted-foreground')}>
              {es ? `Hola, ${userName}.` : `Hi, ${userName}.`}{' '}
              {archived ? (es ? 'Resultados finales.' : 'Final results.')
                : next ? (es ? `${next.label} arranca ${untilLabel(next.firstKickoff)}.` : `${next.label} starts ${untilLabel(next.firstKickoff)}.`)
                : (es ? 'Temporada completa.' : 'Season complete.')}
            </p>
          </div>
          {leagues.length > 0 && (
            <div className="flex shrink-0 gap-1.5">
              <Button asChild variant="outline" size="sm" className={cn('h-9 w-9 rounded-full p-0', ucl && 'border-white/20 bg-white/5 hover:bg-white/10')} title={t('dashboard.joinBtn')}>
                <Link href={`${basePath}/leagues/join`}><UserPlus className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="sm" className="h-9 w-9 rounded-full p-0" title={t('dashboard.createBtn')}>
                <Link href={`${basePath}/leagues/new`}><Plus className="h-4 w-4" /></Link>
              </Button>
            </div>
          )}
        </div>
        {/* Matchday progress dots (league phase) */}
        {ucl && next && next.matchday != null && (
          <div className="mt-4 flex items-center gap-1.5" aria-label={es ? 'Progreso de la fase de liga' : 'League phase progress'}>
            {Array.from({ length: 8 }, (_, i) => i + 1).map((md) => (
              <span key={md} className={cn('h-1.5 flex-1 rounded-full', md < next.matchday! ? 'bg-blue-300/80' : md === next.matchday ? 'bg-white' : 'bg-white/15')} />
            ))}
            <span className="ml-2 text-[11px] font-semibold text-blue-100/80 tabular-nums">J{next.matchday}/8</span>
          </div>
        )}
      </section>

      {leagues.length === 0 ? (
        /* ── EMPTY STATE ──────────────────────────────────────── */
        <div className="flex flex-col items-center justify-center p-8 text-center glass-card border border-border/60 rounded-2xl min-h-[320px] space-y-5">
          <div className="h-16 w-16 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
            <TrophyMark className="h-9 w-9" />
          </div>
          <div className="space-y-2 max-w-sm">
            <h3 className="text-xl font-bold">{es ? 'Comienza tu Polla' : 'Start Your Prediction Pool'}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{t('dashboard.noLeagues')}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs justify-center">
            <Button asChild variant="outline" className="w-full rounded-xl font-bold h-12 border-primary/20 bg-card hover:bg-primary/10">
              <Link href={`${basePath}/leagues/join`}><UserPlus className="h-4 w-4 mr-2" />{t('dashboard.joinBtn')}</Link>
            </Button>
            <Button asChild className="w-full rounded-xl font-bold h-12">
              <Link href={`${basePath}/leagues/new`}><Plus className="h-4 w-4 mr-2" />{t('dashboard.createBtn')}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* ── NEXT ROUND SLIP ──────────────────────────────────── */}
          {next && (
            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2.5">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-primary">
                    {next.liveCount > 0
                      ? <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />{next.liveCount} {es ? 'en vivo' : 'live'}</span>
                      : (es ? 'Próxima jornada' : 'Next round')}
                  </div>
                  <div className="text-lg font-bold leading-tight">
                    {next.label} <span className="text-sm font-medium text-muted-foreground">· {range(next.firstKickoff, next.lastKickoff)}</span>
                  </div>
                </div>
                <div className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums', next.saved === next.total ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300')}>
                  {next.saved}/{next.total}
                </div>
              </header>
              <ul className="divide-y divide-border/50 border-t border-border/50">
                {next.fixtures.slice(0, 6).map((f) => <FixtureRow key={f.id} f={f} es={es} fmtTime={fmtTime} shortName={shortName} />)}
              </ul>
              <footer className="px-4 py-3">
                {next.fixtures.length > 6 && (
                  <div className="mb-2.5 text-center text-xs text-muted-foreground">
                    {(() => { const n = next.fixtures.length - 6; return es ? `+ ${n} ${n === 1 ? 'partido más' : 'partidos más'}` : `+ ${n} more ${n === 1 ? 'game' : 'games'}`; })()}
                  </div>
                )}
                <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(var(--brand-2))] transition-[width]" style={{ width: `${next.total ? (next.saved / next.total) * 100 : 0}%` }} />
                </div>
                <Button asChild className="h-12 w-full rounded-xl text-[15px] font-bold bg-gradient-to-r from-primary to-[hsl(var(--brand-2))] text-primary-foreground shadow-lg shadow-primary/20">
                  <Link href={`${basePath}/matches`}>
                    {next.saved === next.total
                      ? (es ? 'Revisar mis pronósticos' : 'Review my picks')
                      : (es ? `Predecir ${next.total - next.saved} partidos` : `Predict ${next.total - next.saved} games`)}
                  </Link>
                </Button>
              </footer>
            </section>
          )}

          {/* ── LEAGUES: mini standings ─────────────────────────── */}
          <section className="space-y-3">
            {leagues.map((league) => (
              <Link key={league.id} href={`${basePath}/leagues/${league.id}`} className="block overflow-hidden rounded-2xl border border-border/60 bg-card transition-colors hover:border-primary/40">
                <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-base font-bold">{league.name}</h2>
                      {league.isAdmin && <span className="shrink-0 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">{t('common.admin')}</span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{league.memberCount}</span>
                      <span className="font-mono tracking-wider">{league.inviteCode}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{es ? 'Tu puesto' : 'Your rank'}</div>
                    <div className={cn('text-xl font-extrabold leading-none tabular-nums', league.myRank === 1 ? 'text-amber-300' : 'text-foreground')}>
                      {league.myRank != null ? `#${league.myRank}` : '—'}
                    </div>
                  </div>
                </header>
                <ol className="border-t border-border/50">
                  {league.top.map((r) => (
                    <li key={r.userId} className={cn('flex items-center gap-3 px-4 py-2 text-sm', r.isMe && 'bg-primary/[0.08]')}>
                      <span className={cn('w-5 text-center text-xs font-bold tabular-nums', r.rank <= 3 ? 'text-amber-300' : 'text-muted-foreground')}>{r.rank <= 3 ? MEDAL[r.rank - 1] : r.rank}</span>
                      <span className={cn('flex-1 truncate', r.isMe ? 'font-bold text-primary' : 'font-medium')}>{r.displayName}{r.isMe ? (es ? ' (tú)' : ' (you)') : ''}</span>
                      <span className="font-bold tabular-nums">{r.points} <span className="text-[11px] font-medium text-muted-foreground">pts</span></span>
                    </li>
                  ))}
                </ol>
                <footer className="flex items-center justify-end gap-1 border-t border-border/50 px-4 py-2 text-xs font-bold text-primary">
                  {es ? 'Tabla completa' : 'Full standings'} <ChevronRight className="h-3.5 w-3.5" />
                </footer>
              </Link>
            ))}
          </section>
        </>
      )}

      {/* ── HALL OF FAME ─────────────────────────────────────── */}
      {hub && hub.honors.length > 0 && (
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[.2em] text-amber-300/90 flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              {es ? 'Salón de la Fama' : 'Hall of Fame'}
            </h2>
            <Link href={`${basePath}/hall`} className="inline-flex items-center gap-0.5 text-xs font-bold text-primary">
              {es ? 'Ver todo' : 'View all'} <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {hub.honors.map((h) => (
              <Link key={h.tournament.id} href={`${basePath}/hall`} className="block rounded-2xl border border-amber-500/30 p-4 transition-colors hover:border-amber-400/60"
                style={{ background: 'radial-gradient(420px 160px at 50% -30%, rgba(242,196,82,.18), transparent 65%), #0C111C' }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold uppercase tracking-[.25em] text-amber-200/80">{es ? h.tournament.nameEs : h.tournament.nameEn}</div>
                  {h.myRank != null && (
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums', h.myRank <= 3 ? 'bg-amber-400/15 text-amber-200' : 'bg-white/5 text-slate-300')}>
                      {es ? 'Tú' : 'You'} #{h.myRank} · {h.myPoints}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400">{es ? 'Campeón' : 'Champion'}</div>
                    <div className="truncate text-2xl font-bold leading-tight" style={{ fontFamily: SERIF, color: '#F4D488' }}>🏆 {h.podium[0]?.displayName ?? '—'}</div>
                  </div>
                  {h.championCode && (
                    <div className="shrink-0 text-right text-[11px] text-slate-400">
                      <Flag code={h.championCode} emoji={h.championFlagEmoji ?? ''} logoUrl={h.championLogoUrl} className="inline-block h-5 w-auto rounded-[2px]" />
                      <div className="mt-0.5">{h.championName}</div>
                    </div>
                  )}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-300">
                  {h.podium.slice(1).map((p, i) => <span key={p.userId}>{MEDAL[i + 1]} {p.displayName}</span>)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FixtureRow({ f, es, fmtTime, shortName }: {
  f: NextFixture; es: boolean;
  fmtTime: (iso: string) => string; shortName: (n: string) => string;
}) {
  const nm = (s: NextFixture['home']) => shortName(es ? s.nameEs : s.nameEn);
  return (
    <li className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2.5">
      <div className="flex min-w-0 items-center justify-end gap-2 text-sm font-semibold">
        <span className="truncate">{nm(f.home)}</span>
        <Flag code={f.home.code} emoji={f.home.flagEmoji} logoUrl={f.home.logoUrl} className="h-6 w-6 shrink-0 object-contain" />
      </div>
      <div className="flex flex-col items-center">
        {f.myPick ? (
          <span className="rounded-md bg-primary/15 px-2 py-0.5 text-sm font-extrabold tabular-nums text-primary ring-1 ring-inset ring-primary/30">{f.myPick.h}–{f.myPick.a}</span>
        ) : f.locked ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-bold text-muted-foreground"><Lock className="h-3 w-3" /></span>
        ) : (
          <span className="rounded-md border border-dashed border-amber-400/50 px-2 py-0.5 text-xs font-bold text-amber-300">{es ? 'falta' : 'pick'}</span>
        )}
        <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground tabular-nums"><Clock className="h-2.5 w-2.5" />{fmtTime(f.kickoffAt)}</span>
      </div>
      <div className="flex min-w-0 items-center justify-start gap-2 text-sm font-semibold">
        <Flag code={f.away.code} emoji={f.away.flagEmoji} logoUrl={f.away.logoUrl} className="h-6 w-6 shrink-0 object-contain" />
        <span className="truncate">{nm(f.away)}</span>
      </div>
    </li>
  );
}
