'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GitBranch, Star, ChevronDown, Goal, Check, Minus, X } from 'lucide-react';
import { TrophyMark } from '@/components/shared/brand';
import { Flag } from '@/components/shared/Flag';
import { cn } from '@/lib/utils';
import { StatsSections } from './StatsSections';
import type { LeaderboardData, UnifiedLeaderboardEntry, Locale, StatsData } from '@/lib/types';

const MEDAL = ['🥇', '🥈', '🥉'];

// Proportional 3-segment "where the points come from" bar.
function SourceBar({ e }: { e: UnifiedLeaderboardEntry }) {
  const matches = e.groupScore + e.koScore;
  const total = matches + e.bracket + e.bonus;
  if (total <= 0) return <div className="h-1 w-full rounded-full bg-secondary/60" />;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-1 w-full overflow-hidden rounded-full bg-secondary/60">
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
  if (!code || (!emoji && !e.championLogoUrl)) return null;
  return (
    <span className={cn('inline-flex shrink-0', e.championEliminated && 'opacity-40 grayscale')} title={e.championNameEn ?? undefined}>
      <Flag code={code} emoji={emoji ?? ''} logoUrl={e.championLogoUrl} className="inline-block h-3.5 w-auto rounded-[2px] shadow-sm" />
    </span>
  );
}

export function LeaderboardScreen({ data, locale, embedded = false, stats, kind }: { data: LeaderboardData; locale: Locale; embedded?: boolean; stats?: StatsData | null; kind?: 'world_cup' | 'ucl' }) {
  const es = locale === 'es';
  const router = useRouter();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<'standings' | 'stats'>('standings');
  const me = data.entries.find((x) => x.isMe) ?? null;
  const showStats = !embedded && !!stats;
  // The KO-stage tiebreak only matters when two players share the same total —
  // otherwise it's just noise. Track which totals are tied so we can surface it
  // only for those rows.
  const tiedTotals = React.useMemo(() => {
    const counts = new Map<number, number>();
    for (const e of data.entries) counts.set(e.total, (counts.get(e.total) ?? 0) + 1);
    return new Set(Array.from(counts.entries()).filter(([, n]) => n > 1).map(([t]) => t));
  }, [data.entries]);

  if (data.leagues.length === 0) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/50 p-8 text-center">
        <TrophyMark className="h-8 w-8 mx-auto mb-2" />
        <p className="text-sm font-bold">{es ? 'Aún no estás en una liga' : "You're not in a league yet"}</p>
        <Link href={`/${locale}/dashboard`} className="mt-2 inline-block text-xs font-semibold text-primary">
          {es ? 'Crea o únete a una liga →' : 'Create or join a league →'}
        </Link>
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'pb-24'}>
      {/* HEADER — title + league switcher tucked into one tight row. The league
          picker is a compact dropdown (was a row of pills) and only appears when
          you're in more than one league. */}
      {!embedded && (
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h1 className="text-lg font-extrabold tracking-tight flex items-center gap-1.5">
            <TrophyMark className="h-5 w-5" />
            {es ? 'Tabla' : 'Standings'}
          </h1>
          {data.leagues.length > 1 ? (
            <div className="relative shrink-0">
              <select
                value={data.leagueId ?? ''}
                onChange={(e) => router.push(`/${locale}/leaderboard?league=${e.target.value}`, { scroll: false })}
                className="appearance-none rounded-lg border border-border/50 bg-card/70 pl-3 pr-8 py-1.5 text-xs font-bold text-foreground max-w-[55vw] truncate"
                aria-label={es ? 'Elegir liga' : 'Choose league'}
              >
                {data.leagues.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            </div>
          ) : data.leagues.length === 1 ? (
            <span className="shrink-0 max-w-[55vw] truncate text-xs font-bold text-muted-foreground">
              {data.leagues[0].name}
            </span>
          ) : null}
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
        <StatsSections data={stats} locale={locale} kind={kind} />
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

      <div className="space-y-1">
        {data.entries.map((e, idx) => {
          const open = openId === e.userId;
          const matches = e.groupScore + e.koScore;
          // A little 💩 on the bottom three — but only on a board big enough that
          // "last three" is a real trailing group, not most of the league.
          const isBottomThree = data.entries.length >= 6 && idx >= data.entries.length - 3;
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
                className="w-full px-3 py-1.5 text-left"
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
                    {isBottomThree && (
                      <span className="shrink-0 text-sm select-none" title={es ? 'Farolillo rojo' : 'Bringing up the rear'} aria-hidden>💩</span>
                    )}
                    <Movement m={e.movement} />
                  </span>
                  {/* desktop numeric columns */}
                  <span className="hidden md:block text-right text-xs tabular-nums text-muted-foreground">{matches}</span>
                  <span className="hidden md:block text-right text-xs tabular-nums text-sky-300">{e.bracket}</span>
                  <span className="hidden md:block text-right text-xs tabular-nums text-amber-300">{e.bonus}</span>
                  <span className="shrink-0 md:text-right text-base md:text-lg font-extrabold tabular-nums text-foreground">{e.total}</span>
                  <ChevronDown className={cn('md:hidden h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
                </div>
                {/* line 2: source bar (mobile only) */}
                <div className="mt-1 md:hidden"><SourceBar e={e} /></div>
              </button>

              {open && (
                <div className="border-t border-border/30 px-3 py-2.5 text-[12px] space-y-2.5">
                  {/* ── MATCHES: scoreline points, shown as the actual math ── */}
                  <div>
                    <SectionHead
                      icon={<Goal className="h-3.5 w-3.5 text-emerald-400" />}
                      label={es ? 'Marcadores' : 'Scorelines'}
                      accent="text-emerald-300" value={matches}
                    />
                    <div className="mt-1 space-y-0.5 pl-5">
                      <MathLine icon={<Check className="h-3 w-3 text-emerald-400" />}
                        label={es ? 'Exactos' : 'Exact'} count={e.exactCount} mult={6} />
                      <MathLine icon={<Minus className="h-3 w-3 text-sky-400" />}
                        label={es ? 'Acertados' : 'Result'} count={e.resultCount} mult={2} />
                      <MathLine icon={<X className="h-3 w-3 text-rose-400/70" />}
                        label={es ? 'Fallados' : 'Missed'} count={e.wrongCount} mult={0} muted />
                    </div>
                    <p className="mt-0.5 pl-5 text-[10px] text-muted-foreground">
                      {es ? 'Grupos' : 'Group'} {e.groupScore} · {es ? 'Eliminatorias' : 'KO'} {e.koScore}
                    </p>
                  </div>

                  {/* ── BRACKET: advancement points + how many spots are right ── */}
                  <div>
                    <SectionHead
                      icon={<GitBranch className="h-3.5 w-3.5 text-sky-400" />}
                      label={es ? 'Llave (avance)' : 'Bracket'}
                      accent="text-sky-300" value={e.bracket}
                    />
                    <p className="mt-0.5 pl-5 text-[10px] text-muted-foreground">
                      <span className="font-semibold text-emerald-400">{e.bracketCorrect}</span> {es ? 'aciertos' : 'correct'}
                      {e.bracketAlive > 0 && (
                        <> · <span className="font-semibold text-sky-300">{e.bracketAlive}</span> {es ? 'aún vivos' : 'still alive'}</>
                      )}
                    </p>
                  </div>

                  {/* ── BONUS picks ── */}
                  <SectionHead
                    icon={<Star className="h-3.5 w-3.5 text-amber-400" />}
                    label={es ? 'Bonos' : 'Bonus'}
                    accent="text-amber-300" value={e.bonus}
                  />

                  {/* ── TOTAL ── */}
                  <div className="flex items-baseline justify-between border-t border-border/30 pt-2 font-extrabold">
                    <span>{es ? 'Total' : 'Total'}</span>
                    <span className="tabular-nums text-base">
                      {e.total}
                      {tiedTotals.has(e.total) && (
                        <span className="ml-1 font-normal text-[10px] text-muted-foreground">
                          · {es ? 'desempate' : 'tiebreak'} {e.koTiebreak}
                        </span>
                      )}
                    </span>
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

// A category header row: icon + label on the left, the category's point total
// (accent-colored) on the right.
function SectionHead({ icon, label, accent, value }: { icon: React.ReactNode; label: string; accent: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 min-w-0 font-bold uppercase tracking-wide text-[11px]">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className={cn('shrink-0 tabular-nums font-extrabold', accent)}>{value}<span className="ml-0.5 text-[9px] font-semibold text-muted-foreground">pts</span></span>
    </div>
  );
}

// One line of the scoreline math: "Exact  3 × 6 = 18". Zero-multiplier rows
// (misses) render muted with no trailing subtotal noise.
function MathLine({ icon, label, count, mult, muted = false }: { icon: React.ReactNode; label: string; count: number; mult: number; muted?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-2 tabular-nums', muted && 'opacity-60')}>
      <span className="flex items-center gap-1.5 min-w-0">
        {icon}
        <span className="truncate text-[11px]">{label}</span>
      </span>
      <span className="shrink-0 text-[11px] text-muted-foreground">
        {count} <span className="opacity-70">× {mult}</span>
        <span className="mx-1 opacity-40">=</span>
        <span className={cn('font-bold', muted ? 'text-muted-foreground' : 'text-foreground')}>{count * mult}</span>
      </span>
    </div>
  );
}
