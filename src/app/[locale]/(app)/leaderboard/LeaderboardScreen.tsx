'use client';

import * as React from 'react';
import Link from 'next/link';
import { Trophy, GitBranch, Star, ChevronDown, Goal } from 'lucide-react';
import { Flag } from '@/components/shared/Flag';
import { cn } from '@/lib/utils';
import { StatsSections } from './StatsSections';
import type { LeaderboardData, UnifiedLeaderboardEntry, Locale, StatsData } from '@/lib/types';

const MEDAL = ['🥇', '🥈', '🥉'];

// Proportional 3-segment "where the points come from" bar.
function SourceBar({ e }: { e: UnifiedLeaderboardEntry }) {
  const matches = e.groupScore + e.koScore;
  const total = matches + e.bracket + e.bonus;
  if (total <= 0) return <div className="h-1.5 w-full rounded-full bg-secondary/60" />;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-secondary/60">
      <span className="bg-emerald-500" style={{ width: pct(matches) }} />
      <span className="bg-sky-500" style={{ width: pct(e.bracket) }} />
      <span className="bg-amber-400" style={{ width: pct(e.bonus) }} />
    </div>
  );
}

// Rank movement since the most recent result day (▲ up / ▼ down).
function Movement({ m }: { m: number | null }) {
  if (m == null || m === 0) return null;
  const up = m > 0;
  return (
    <span className={cn('shrink-0 inline-flex items-center text-[10px] font-bold tabular-nums', up ? 'text-emerald-400' : 'text-rose-400')}>
      {up ? '▲' : '▼'}{Math.abs(m)}
    </span>
  );
}

function ChampionFlag({ e }: { e: UnifiedLeaderboardEntry }) {
  const code = e.championCode;
  const emoji = e.championFlagEmoji;
  if (!code || !emoji) return null;
  return (
    <span className={cn('inline-flex shrink-0', e.championEliminated && 'opacity-40 grayscale')} title={e.championNameEn ?? undefined}>
      <Flag code={code} emoji={emoji} className="inline-block h-3.5 w-auto rounded-[2px] shadow-sm" />
    </span>
  );
}

export function LeaderboardScreen({ data, locale, embedded = false, stats }: { data: LeaderboardData; locale: Locale; embedded?: boolean; stats?: StatsData | null }) {
  const es = locale === 'es';
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<'standings' | 'stats'>('standings');
  const me = data.entries.find((x) => x.isMe) ?? null;
  const showStats = !embedded && !!stats;

  if (data.leagues.length === 0) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/50 p-8 text-center">
        <Trophy className="h-7 w-7 text-amber-500 mx-auto mb-2" />
        <p className="text-sm font-bold">{es ? 'Aún no estás en una liga' : "You're not in a league yet"}</p>
        <Link href={`/${locale}/dashboard`} className="mt-2 inline-block text-xs font-semibold text-primary">
          {es ? 'Crea o únete a una liga →' : 'Create or join a league →'}
        </Link>
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'pb-24'}>
      {!embedded && (
        <div className="mb-3">
          <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            {es ? 'Tabla de posiciones' : 'Leaderboard'}
          </h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {es ? 'Toca a alguien para ver de dónde salen sus puntos' : 'Tap anyone to see where their points come from'}
          </p>
        </div>
      )}

      {/* LEAGUE FILTER — only on the standalone screen, and only when in >1 league */}
      {!embedded && data.leagues.length > 1 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto scrollbar-none">
          {data.leagues.map((l) => {
            const active = l.id === data.leagueId;
            return (
              <Link
                key={l.id}
                href={`/${locale}/leaderboard?league=${l.id}`}
                scroll={false}
                className={cn(
                  'flex-shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold whitespace-nowrap border transition-colors',
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card/50 text-muted-foreground border-border/40'
                )}
              >
                {l.name}
              </Link>
            );
          })}
        </div>
      )}

      {/* STANDINGS | STATS toggle (standalone screen only) */}
      {showStats && (
        <div className="mb-3 flex rounded-lg border border-border/40 bg-card/50 p-0.5 text-xs font-bold">
          {(['standings', 'stats'] as const).map((tk) => (
            <button
              key={tk}
              type="button"
              onClick={() => setTab(tk)}
              className={cn('flex-1 rounded-md py-1.5 transition-colors', tab === tk ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
            >
              {tk === 'standings' ? (es ? 'Tabla' : 'Standings') : (es ? 'Estadísticas' : 'Stats')}
            </button>
          ))}
        </div>
      )}

      {tab === 'stats' && stats ? (
        <StatsSections data={stats} locale={locale} />
      ) : (
      <>
      {/* quick self-locator */}
      {me && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-primary/40 bg-primary/[0.07] px-3 py-1.5 text-[11px]">
          <span className="font-semibold text-primary">{es ? 'Tú' : 'You'} · #{me.rank}</span>
          <span className="font-extrabold tabular-nums">{me.total} pts</span>
        </div>
      )}

      {/* desktop column header */}
      <div className="hidden md:grid grid-cols-[2.5rem_1fr_4rem_4rem_4rem_4.5rem] gap-2 px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
        <span>#</span><span>{es ? 'Jugador' : 'Player'}</span>
        <span className="text-right">{es ? 'Partidos' : 'Matches'}</span>
        <span className="text-right">{es ? 'Llave' : 'Bracket'}</span>
        <span className="text-right">{es ? 'Bonos' : 'Bonus'}</span>
        <span className="text-right">Total</span>
      </div>

      <div className="space-y-1.5">
        {data.entries.map((e) => {
          const open = openId === e.userId;
          const matches = e.groupScore + e.koScore;
          return (
            <div
              key={e.userId}
              className={cn(
                'rounded-xl border bg-card/50 overflow-hidden',
                e.isMe ? 'border-primary/50 ring-1 ring-primary/30' : 'border-border/45'
              )}
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : e.userId)}
                className="w-full px-3 py-2.5 text-left"
              >
                {/* line 1 */}
                <div className="md:grid md:grid-cols-[2.5rem_1fr_4rem_4rem_4rem_4.5rem] md:gap-2 md:items-center flex items-center gap-2">
                  <span className={cn('shrink-0 w-7 md:w-auto text-center text-sm font-extrabold tabular-nums',
                    e.rank === 1 ? 'text-amber-400' : e.rank === 2 ? 'text-slate-300' : e.rank === 3 ? 'text-amber-700' : 'text-muted-foreground')}>
                    {e.rank <= 3 ? MEDAL[e.rank - 1] : e.rank}
                  </span>
                  <span className="min-w-0 flex-1 flex items-center gap-1.5">
                    <ChampionFlag e={e} />
                    <span className="truncate text-[13px] font-bold">
                      {e.displayName}{e.isMe && <span className="ml-1 text-[10px] font-semibold text-primary">{es ? '(tú)' : '(you)'}</span>}
                    </span>
                    <Movement m={e.movement} />
                  </span>
                  {/* desktop numeric columns */}
                  <span className="hidden md:block text-right text-xs tabular-nums text-muted-foreground">{matches}</span>
                  <span className="hidden md:block text-right text-xs tabular-nums text-sky-300">{e.bracket}</span>
                  <span className="hidden md:block text-right text-xs tabular-nums text-amber-300">{e.bonus}</span>
                  <span className="shrink-0 md:text-right text-lg font-extrabold tabular-nums text-foreground">{e.total}</span>
                  <ChevronDown className={cn('md:hidden h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
                </div>
                {/* line 2: source bar (mobile only) */}
                <div className="mt-1.5 md:hidden"><SourceBar e={e} /></div>
              </button>

              {open && (
                <div className="border-t border-border/30 px-3 py-2.5 text-[12px] space-y-1.5">
                  <Row icon={<Goal className="h-3.5 w-3.5 text-emerald-400" />} label={es ? 'Partidos (marcadores)' : 'Matches (scorelines)'}
                    sub={`${es ? 'Grupos' : 'Group'} ${e.groupScore} · ${es ? 'Eliminatorias' : 'KO'} ${e.koScore}`} value={matches} />
                  <Row icon={<GitBranch className="h-3.5 w-3.5 text-sky-400" />} label={es ? 'Avance en la llave' : 'Bracket advancement'} value={e.bracket} />
                  <Row icon={<Star className="h-3.5 w-3.5 text-amber-400" />} label={es ? 'Picks de bonos' : 'Bonus picks'} value={e.bonus} />
                  <div className="flex items-center justify-between border-t border-border/30 pt-1.5 font-extrabold">
                    <span>{es ? 'Total' : 'Total'}</span>
                    <span className="tabular-nums">{e.total} <span className="font-normal text-[10px] text-muted-foreground">· {es ? 'desempate KO' : 'KO tiebreak'} {e.koTiebreak}</span></span>
                  </div>
                  <Link
                    href={`/${locale}/bracket?peer=${e.userId}`}
                    className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-border/50 bg-secondary/40 py-2 text-xs font-bold text-primary"
                  >
                    <GitBranch className="h-3.5 w-3.5" />
                    {es ? `Ver la llave de ${e.displayName}` : `View ${e.displayName}'s bracket`} →
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
      </>
      )}
    </div>
  );
}

function Row({ icon, label, sub, value }: { icon: React.ReactNode; label: string; sub?: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 min-w-0">
        {icon}
        <span className="truncate">{label}{sub && <span className="block text-[10px] text-muted-foreground">{sub}</span>}</span>
      </span>
      <span className="shrink-0 tabular-nums font-semibold">{value}</span>
    </div>
  );
}
