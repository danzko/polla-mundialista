'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Lock, Trophy, Check, X, LayoutList, GitBranch, HelpCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { submitBracket } from '@/lib/api';
import {
  BRACKET_BY_MATCH, ROUND_ORDER, parseFeed, ADVANCEMENT_POINTS_BY_MATCH,
  type KnockoutRound,
} from '@/lib/bracket';
import { knockoutSlotLabel } from '@/lib/bracket-slots';
import { LOCK_BEFORE_KICKOFF_MS } from '@/lib/tournament';
import { Flag } from '@/components/shared/Flag';
import { cn } from '@/lib/utils';
import type { BracketView, Team, Locale, BracketComparison } from '@/lib/types';

interface BracketBoardProps {
  initialBracket: BracketView;
  comparison?: BracketComparison;
  teams: Team[];
  locale: Locale;
}

type Pick = { advancerTeamId: string | null; homeScore: number | null; awayScore: number | null };
type PickStatus = 'earned' | 'dead' | 'pending' | null;

const ROUND_LABEL: Record<KnockoutRound, { es: string; en: string }> = {
  r32: { es: '32avos', en: 'Round of 32' },
  r16: { es: 'Octavos', en: 'Round of 16' },
  qf: { es: 'Cuartos', en: 'Quarterfinals' },
  sf: { es: 'Semifinal', en: 'Semifinals' },
  final: { es: 'Final', en: 'Final' },
  third_place: { es: '3er Puesto', en: 'Third place' },
};

// Coloring for an advancer chip once results exist. A still-in-play pick stays
// green ("you picked this"); a pick that has HIT goes gold with an inset ring —
// so a correct pick reads as clearly more than just "selected"; red = dead.
const STATUS_ROW: Record<'earned' | 'dead' | 'pending', string> = {
  earned: 'bg-amber-400/15 text-amber-200 font-bold ring-1 ring-inset ring-amber-400/60',
  dead: 'bg-rose-500/12 text-rose-300/70 line-through ring-1 ring-inset ring-rose-500/40',
  pending: 'bg-amber-500/10 text-amber-200 font-semibold',
};
const STATUS_DOT: Record<'earned' | 'dead' | 'pending', string> = {
  earned: 'border-amber-300 bg-amber-300 text-background',
  dead: 'border-rose-400 bg-rose-400 text-background',
  pending: 'border-amber-400/70 bg-transparent text-amber-300',
};

// Small "+N" pill showing what a correct pick in this match is worth.
function PointsPill({ mn, earned }: { mn: number; earned?: boolean }) {
  const pts = ADVANCEMENT_POINTS_BY_MATCH[mn];
  if (!pts) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-bold tabular-nums',
        earned ? 'bg-amber-400/20 text-amber-200 ring-1 ring-inset ring-amber-400/50' : 'bg-primary/10 text-primary/80'
      )}
      title={mn === 104 ? 'Champion' : `+${pts} if correct`}
    >
      +{pts}{mn === 104 ? '👑' : ''}
    </span>
  );
}

export function BracketBoard({ initialBracket, comparison, teams, locale }: BracketBoardProps) {
  const t = useTranslations();
  const es = locale === 'es';

  // Post-deadline comparison data (real results so far + every league-mate's
  // bracket). Drives the points-per-pick pills, the green/red/grey coloring,
  // browsing other people's brackets, and the bracket standings.
  const compareReady = !!comparison?.available && comparison.peers.length > 0;
  const earnedSet = React.useMemo(() => {
    const s = new Set<string>();
    if (!comparison) return s;
    for (const [mn, team] of Object.entries(comparison.actualAdvancers)) {
      const w = ADVANCEMENT_POINTS_BY_MATCH[Number(mn)];
      if (w) s.add(`${w}:${team}`);
    }
    return s;
  }, [comparison]);
  const eliminatedSet = React.useMemo(
    () => new Set(comparison?.eliminatedTeamIds ?? []),
    [comparison]
  );
  const statusOf = React.useCallback(
    (matchNumber: number, teamId: string | null): PickStatus => {
      if (!teamId || !comparison?.available) return null;
      // The 3rd-place game earns no advancement points, so don't color it as
      // earned/dead — keep it neutral (consistent with showing no points pill).
      if (matchNumber === 103) return null;
      const w = ADVANCEMENT_POINTS_BY_MATCH[matchNumber];
      if (w && earnedSet.has(`${w}:${teamId}`)) return 'earned';
      const actual = comparison.actualAdvancers[matchNumber];
      if (actual !== undefined && actual !== teamId) return 'dead';
      if (eliminatedSet.has(teamId)) return 'dead';
      return 'pending';
    },
    [comparison, earnedSet, eliminatedSet]
  );

  // How popular each advancer pick is across the league (post-deadline): what
  // share of league-mates also sent a given team through a given match. Powers
  // the small "62%" chip next to each team in the bracket view.
  const pickPopularity = React.useMemo(() => {
    const counts = new Map<string, number>();
    const peers = comparison?.peers ?? [];
    for (const peer of peers) {
      for (const [mn, team] of Object.entries(peer.advancers)) {
        if (!team) continue;
        counts.set(`${mn}:${team}`, (counts.get(`${mn}:${team}`) ?? 0) + 1);
      }
    }
    return { counts, total: peers.length };
  }, [comparison]);
  const pctFor = React.useCallback(
    (matchNumber: number, teamId: string | null): number | null => {
      if (!teamId || !comparison?.available || !pickPopularity.total) return null;
      const c = pickPopularity.counts.get(`${matchNumber}:${teamId}`) ?? 0;
      return Math.round((c / pickPopularity.total) * 100);
    },
    [comparison, pickPopularity]
  );

  // Which bracket is on screen: your own, or a league-mate's (post-deadline).
  const [peerId, setPeerId] = React.useState<string | null>(null);
  const peerById = React.useMemo(
    () => new Map((comparison?.peers ?? []).map((p) => [p.userId, p])),
    [comparison]
  );
  const viewingPeer = peerId ? peerById.get(peerId) ?? null : null;

  // Deep link: /bracket?peer=<userId> (e.g. from the leaderboard's "view
  // bracket" link) opens that league-mate's bracket once, read-only.
  const searchParams = useSearchParams();
  const didInitPeer = React.useRef(false);
  React.useEffect(() => {
    if (didInitPeer.current) return;
    const p = searchParams.get('peer');
    if (p && peerById.has(p)) { setPeerId(p); setView('ladder'); }
    didInitPeer.current = true;
  }, [searchParams, peerById]);
  const peerPicks = React.useMemo<Record<number, Pick>>(() => {
    if (!viewingPeer) return {};
    const rec: Record<number, Pick> = {};
    for (const [mn, team] of Object.entries(viewingPeer.advancers)) {
      rec[Number(mn)] = { advancerTeamId: team, homeScore: null, awayScore: null };
    }
    return rec;
  }, [viewingPeer]);

  const teamById = React.useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const matchByNumber = React.useMemo(
    () => new Map(initialBracket.matches.map((m) => [m.matchNumber, m])),
    [initialBracket.matches]
  );

  const [picks, setPicks] = React.useState<Record<number, Pick>>(() => {
    const init: Record<number, Pick> = {};
    for (const m of initialBracket.matches) {
      init[m.matchNumber] = {
        advancerTeamId: m.myAdvancerTeamId,
        homeScore: m.myHomeScore,
        awayScore: m.myAwayScore,
      };
    }
    return init;
  });

  const [roundIdx, setRoundIdx] = React.useState(0);
  // Once the bracket is locked everyone's picks are in, so open straight to the
  // read-only filled bracket; only show the entry screen by default while it's
  // still fillable.
  const [view, setView] = React.useState<'fill' | 'ladder'>(initialBracket.locked ? 'ladder' : 'fill');
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  // `locked` = the whole bracket is closed (entry deadline passed). Individual
  // games can lock earlier — a pick locks at min(deadline, its kickoff - 15m) —
  // so a game that kicks off before the deadline (e.g. the first R32 match)
  // closes when it starts while the rest stay open until the deadline.
  const locked = initialBracket.locked;
  const deadlineMs = initialBracket.lockAt ? new Date(initialBracket.lockAt).getTime() : null;
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const matchLocked = React.useCallback(
    (mn: number) => {
      if (locked) return true;
      const mv = matchByNumber.get(mn);
      if (!mv?.kickoffAt) return false;
      const koLock = new Date(mv.kickoffAt).getTime() - LOCK_BEFORE_KICKOFF_MS;
      const lockMoment = deadlineMs != null ? Math.min(deadlineMs, koLock) : koLock;
      return now >= lockMoment;
    },
    [locked, matchByNumber, deadlineMs, now]
  );

  // Resolve which real/predicted team sits on a side of a match.
  const sideTeam = React.useCallback(
    (matchNumber: number, side: 'home' | 'away', p = picks): string | null => {
      const node = BRACKET_BY_MATCH[matchNumber];
      if (!node) return null;
      const ref = side === 'home' ? node.home : node.away;
      const feed = parseFeed(ref);
      if (!feed) {
        // R32 group slot → the real team once assigned from group results.
        const mv = matchByNumber.get(matchNumber);
        return (side === 'home' ? mv?.homeTeamId : mv?.awayTeamId) ?? null;
      }
      const adv = p[feed.match]?.advancerTeamId ?? null;
      if (feed.kind === 'W') return adv;
      // Loser = the other participant of the feeder match.
      if (!adv) return null;
      const fh = sideTeam(feed.match, 'home', p);
      const fa = sideTeam(feed.match, 'away', p);
      return adv === fh ? fa : adv === fa ? fh : null;
    },
    [picks, matchByNumber]
  );

  const labelFor = (matchNumber: number, side: 'home' | 'away', teamId: string | null): React.ReactNode => {
    if (teamId) {
      const tm = teamById.get(teamId);
      if (!tm) return '—';
      return (
        <span className="inline-flex items-center gap-1.5 min-w-0 align-middle">
          <Flag code={tm.code} emoji={tm.flagEmoji} className="inline-block h-3 w-auto rounded-[2px] shrink-0 shadow-sm" />
          <span className="truncate">{es ? tm.nameEs : tm.nameEn}</span>
        </span>
      );
    }
    return knockoutSlotLabel(matchNumber, side, locale) ?? (es ? 'Por definir' : 'TBD');
  };

  // After changing an advancer, clear any downstream pick whose advancer is
  // no longer one of that match's (re-derived) participants.
  const setAdvancer = (matchNumber: number, teamId: string) => {
    if (matchLocked(matchNumber)) return;
    setPicks((prev) => {
      const next = { ...prev, [matchNumber]: { ...prev[matchNumber], advancerTeamId: teamId } };
      let changed = true;
      while (changed) {
        changed = false;
        for (const node of Object.values(BRACKET_BY_MATCH)) {
          const adv = next[node.match]?.advancerTeamId;
          if (!adv) continue;
          const h = sideTeam(node.match, 'home', next);
          const a = sideTeam(node.match, 'away', next);
          if (adv !== h && adv !== a) {
            next[node.match] = { ...next[node.match], advancerTeamId: null };
            changed = true;
          }
        }
      }
      return next;
    });
  };

  const round = ROUND_ORDER[roundIdx];
  const roundGames = round.matches;
  const chosenInRound = roundGames.filter((m) => picks[m]?.advancerTeamId).length;

  // Whose picks are on screen (own while filling/own ladder; a peer's when browsing).
  const displayPicks = viewingPeer ? peerPicks : picks;
  const championId = displayPicks[104]?.advancerTeamId ?? null;

  const handleSave = async () => {
    setSaving(true);
    setToast(null);
    const payload = initialBracket.matches
      .map((m) => {
        const cur = picks[m.matchNumber]?.advancerTeamId ?? null;
        const had = m.myAdvancerTeamId ?? null;
        // Send a row when there's a current pick OR a previously-saved pick to
        // clear (changing an earlier winner clears downstream picks — those
        // cleared matches must be persisted as null, not silently dropped, or
        // the stale rows survive and still score). Advancer-only; scorelines
        // are predicted per round in the Matches tab.
        if (cur === null && had === null) return null;
        return { matchId: m.matchId, advancerTeamId: cur, homeScore: null, awayScore: null };
      })
      .filter(Boolean) as Array<{ matchId: string; advancerTeamId: string | null; homeScore: number | null; awayScore: number | null }>;
    const res = await submitBracket({ picks: payload });
    setSaving(false);
    setToast(res.ok ? (es ? '¡Llave guardada!' : 'Bracket saved!') : res.error);
  };

  // R32 teams not yet assigned (groups not concluded) → can't fill yet.
  const r32Ready = ROUND_ORDER[0].matches.some(
    (m) => matchByNumber.get(m)?.homeTeamId && matchByNumber.get(m)?.awayTeamId
  );

  const fmtLockDate = initialBracket.lockAt
    ? new Intl.DateTimeFormat(es ? 'es-CO' : 'en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(initialBracket.lockAt)) + ' ET'
    : null;

  return (
    <div className={!locked && r32Ready ? 'pb-28' : 'pb-10'}>
      {/* HEADER */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            {es ? 'La Llave' : 'The Bracket'}
          </h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {locked ? (
              <span className="text-amber-500 font-semibold flex items-center gap-1">
                <Lock className="h-3 w-3" /> {es ? 'Cerrada' : 'Locked'}
              </span>
            ) : fmtLockDate ? (
              <>{es ? 'Se cierra' : 'Locks'} {fmtLockDate}</>
            ) : (es ? 'Eliminatorias' : 'Knockouts')}
          </p>
          <Link
            href={`/${locale}/rules`}
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary"
          >
            <HelpCircle className="h-3 w-3" />
            {es ? 'Cómo se puntúa' : 'How scoring works'}
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          {!viewingPeer && (
            <button
              onClick={() => setView((v) => (v === 'fill' ? 'ladder' : 'fill'))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground"
            >
              {view === 'fill' ? <GitBranch className="h-3.5 w-3.5" /> : <LayoutList className="h-3.5 w-3.5" />}
              {view === 'fill' ? (es ? 'Ver llave' : 'View bracket') : (es ? 'Llenar' : 'Fill in')}
            </button>
          )}
        </div>
      </div>

      {/* PEER SELECTOR — choose whose bracket to view (post-deadline, league-scoped) */}
      {compareReady && (
        <div className="mb-3 flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground shrink-0">{es ? 'Viendo' : 'Viewing'}</span>
          <div className="relative">
            <select
              value={peerId ?? '__me__'}
              onChange={(e) => {
                const v = e.target.value;
                setPeerId(v === '__me__' ? null : v);
                if (v !== '__me__') setView('ladder');
              }}
              className="appearance-none rounded-lg border border-border/50 bg-card/70 pl-2.5 pr-7 py-1.5 font-semibold text-foreground max-w-[60vw] truncate"
            >
              <option value="__me__">{es ? 'Tu llave' : 'Your bracket'}</option>
              {comparison!.peers.filter((p) => !p.isMe).map((p) => (
                <option key={p.userId} value={p.userId}>{p.displayName} · {p.points} pts</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>
          {viewingPeer && (
            <span className="inline-flex items-center gap-1 text-emerald-300 font-bold">
              {viewingPeer.points} pts
              <span className="text-muted-foreground font-normal">· {viewingPeer.correctPicks} {es ? 'aciertos' : 'hits'}</span>
            </span>
          )}
        </div>
      )}

      {!mounted ? (
        <div className="p-10 text-center text-muted-foreground animate-pulse">{t('common.loading')}</div>
      ) : !r32Ready && !locked ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-6 text-center">
          <Trophy className="h-7 w-7 text-amber-500 mx-auto mb-2" />
          <p className="text-sm font-bold">{es ? 'Aún no se habilita' : 'Not open yet'}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {es
              ? 'La llave se llena cuando terminen los grupos y se conozcan los 32 clasificados (27 jun). Vuelve entonces para armar tu bracket.'
              : 'The bracket opens once the groups finish and the 32 qualifiers are set (Jun 27). Come back then to fill it out.'}
          </p>
        </div>
      ) : view === 'ladder' || viewingPeer ? (
        <LadderView
          rounds={ROUND_ORDER}
          sideTeam={sideTeam}
          labelFor={labelFor}
          picks={displayPicks}
          championId={championId}
          statusOf={statusOf}
          pctFor={pctFor}
          es={es}
        />
      ) : (
        <>
          {/* ROUND TABS */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none mb-3">
            {ROUND_ORDER.map((r, i) => (
              <button
                key={r.round}
                onClick={() => setRoundIdx(i)}
                className={cn(
                  'flex-shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap border transition-colors',
                  i === roundIdx
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card/50 text-muted-foreground border-border/40'
                )}
              >
                {es ? ROUND_LABEL[r.round].es : ROUND_LABEL[r.round].en}
              </button>
            ))}
          </div>

          <div className={cn('mb-2 text-[11px]', locked ? 'text-emerald-400 font-semibold' : 'text-muted-foreground')}>
            {locked
              ? (es ? '✓ Tus picks están guardados y bloqueados' : '✓ Your picks are saved & locked in')
              : (es ? `Toca quién avanza · ${chosenInRound}/${roundGames.length} listos` : `Tap who advances · ${chosenInRound}/${roundGames.length} set`)}
          </div>
          {!locked && (
            <div className="mb-3 rounded-lg border border-border/40 bg-secondary/30 px-2.5 py-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
              {es
                ? 'Aquí eliges solo quién avanza (los puntos grandes). Tienes hasta el cierre de hoy para toda la llave — salvo un partido que ya empiece, que se cierra a su hora de inicio. '
                : 'Here you pick only who advances (the big points). You have until tonight’s deadline for the whole bracket — except a game that kicks off sooner, which closes at its start. '}
              <Link href={`/${locale}/matches`} className="font-semibold text-primary">
                {es ? 'Los marcadores se predicen en Partidos →' : 'Predict scorelines in Matches →'}
              </Link>
            </div>
          )}

          {/* GAMES IN ROUND */}
          <div className="space-y-2.5">
            {roundGames.map((mn) => {
              const homeId = sideTeam(mn, 'home');
              const awayId = sideTeam(mn, 'away');
              const p = picks[mn] ?? { advancerTeamId: null, homeScore: null, awayScore: null };
              const ready = !!homeId && !!awayId;
              const mLocked = matchLocked(mn);
              return (
                <div key={mn} className="rounded-xl border border-border/45 bg-card/50 overflow-hidden">
                  <div className="px-2.5 py-1 text-[10px] text-muted-foreground/80 bg-secondary/40 flex items-center gap-1.5">
                    <span>{es ? 'Partido' : 'Match'} {mn}</span>
                    <PointsPill mn={mn} earned={statusOf(mn, p.advancerTeamId) === 'earned'} />
                    {!ready && <span>· {es ? 'esperando equipos' : 'awaiting teams'}</span>}
                    {ready && mLocked && (
                      <span className="ml-auto inline-flex items-center gap-1 text-amber-500 font-semibold">
                        <Lock className="h-2.5 w-2.5" /> {es ? 'cerrado' : 'locked'}
                      </span>
                    )}
                  </div>
                  {(['home', 'away'] as const).map((side, idx) => {
                    const teamId = side === 'home' ? homeId : awayId;
                    const isWinner = !!teamId && p.advancerTeamId === teamId;
                    const selectable = ready && !mLocked;
                    // Once a game is PLAYED, recolor the pick (green correct /
                    // red wrong). A not-yet-played pick must still read as
                    // clearly locked in (filled dot + check) — never hollow —
                    // so 'pending' gets no restyle.
                    const st = isWinner ? statusOf(mn, teamId) : null;
                    const resultSt = st === 'earned' || st === 'dead' ? st : null;
                    return (
                      <button
                        key={side}
                        type="button"
                        disabled={!selectable}
                        onClick={() => teamId && setAdvancer(mn, teamId)}
                        className={cn(
                          // Whole row is the click target (clear, large hit area).
                          'w-full flex items-center justify-between gap-2 px-2.5 py-2.5 text-[13px] text-left transition-colors',
                          idx === 0 && 'border-b border-border/30',
                          resultSt ? STATUS_ROW[resultSt] : isWinner ? 'bg-emerald-500/15 font-bold text-emerald-300' : 'text-foreground',
                          selectable && !isWinner && 'hover:bg-secondary/60 cursor-pointer',
                          !selectable && 'cursor-default'
                        )}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              'shrink-0 flex h-4 w-4 items-center justify-center rounded-full border transition-colors',
                              resultSt ? STATUS_DOT[resultSt]
                                : isWinner ? 'border-emerald-400 bg-emerald-400 text-background'
                                : selectable ? 'border-muted-foreground/50' : 'border-transparent'
                            )}
                          >
                            {isWinner && (resultSt === 'dead'
                              ? <X className="h-3 w-3" strokeWidth={3} />
                              : <Check className="h-3 w-3" />)}
                          </span>
                          <span className="truncate">{labelFor(mn, side, teamId)}</span>
                        </span>
                        {selectable && !isWinner && (
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-primary/70">
                            {es ? 'elegir' : 'pick'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* CHAMPION CALLOUT on the final round */}
          {round.round === 'final' && championId && (
            <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/[0.08] p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-amber-500 font-bold">{es ? 'Tu campeón en la llave' : 'Your bracket champion'}</div>
              <div className="text-base font-extrabold mt-0.5">{labelFor(104, 'home', championId)}</div>
            </div>
          )}

          {/* ROUND NAV */}
          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="ghost"
              disabled={roundIdx === 0}
              onClick={() => setRoundIdx((i) => Math.max(0, i - 1))}
              className="rounded-xl text-xs font-bold text-muted-foreground border border-border/40 disabled:opacity-40"
            >
              ‹ {es ? 'Atrás' : 'Back'}
            </Button>
            <Button
              variant="ghost"
              disabled={roundIdx === ROUND_ORDER.length - 1}
              onClick={() => setRoundIdx((i) => Math.min(ROUND_ORDER.length - 1, i + 1))}
              className="rounded-xl text-xs font-bold text-muted-foreground border border-border/40 disabled:opacity-40"
            >
              {es ? ROUND_LABEL[ROUND_ORDER[Math.min(ROUND_ORDER.length - 1, roundIdx + 1)].round].es : ROUND_LABEL[ROUND_ORDER[Math.min(ROUND_ORDER.length - 1, roundIdx + 1)].round].en} ›
            </Button>
          </div>
        </>
      )}

      {/* SAVE BAR */}
      {!locked && r32Ready && (
        <div className="fixed bottom-[57px] md:bottom-0 left-0 w-full z-30 border-t border-border bg-card/90 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground">
              {toast ?? (es ? 'Guarda cuando quieras; editable hasta el cierre' : 'Save anytime; editable until lock')}
            </span>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl px-4 py-2 font-extrabold text-xs sm:text-sm bg-gradient-to-r from-primary to-emerald-500 text-primary-foreground"
            >
              {saving ? (es ? 'Guardando…' : 'Saving…') : (es ? 'Guardar llave' : 'Save bracket')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Read-only full-bracket ladder (scrollable columns) ----
function LadderView({
  rounds, sideTeam, labelFor, picks, championId, statusOf, pctFor, es,
}: {
  rounds: typeof ROUND_ORDER;
  sideTeam: (m: number, s: 'home' | 'away', p?: Record<number, Pick>) => string | null;
  labelFor: (m: number, s: 'home' | 'away', id: string | null) => React.ReactNode;
  picks: Record<number, Pick>;
  championId: string | null;
  statusOf: (m: number, id: string | null) => PickStatus;
  pctFor: (m: number, id: string | null) => number | null;
  es: boolean;
}) {
  // Order columns left→right; put third-place last as a small aside.
  const cols = rounds.filter((r) => r.round !== 'third_place');
  const third = rounds.find((r) => r.round === 'third_place');
  return (
    <div className="overflow-x-auto scrollbar-none -mx-1 px-1">
      <div className="flex gap-3 min-w-max items-stretch">
        {cols.map((r) => (
          <div key={r.round} className="flex flex-col justify-around gap-2 min-w-[152px]">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-bold text-center">
              {es ? ROUND_LABEL[r.round].es : ROUND_LABEL[r.round].en}
            </div>
            {r.matches.map((mn) => {
              const homeId = sideTeam(mn, 'home', picks);
              const awayId = sideTeam(mn, 'away', picks);
              const adv = picks[mn]?.advancerTeamId ?? null;
              return (
                <div key={mn} className="rounded-lg border border-border/40 bg-card/50 overflow-hidden text-[11px]">
                  {(['home', 'away'] as const).map((side, i) => {
                    const id = side === 'home' ? homeId : awayId;
                    const win = !!id && adv === id;
                    const st = win ? statusOf(mn, id) : null;
                    const resultSt = st === 'earned' || st === 'dead' ? st : null;
                    const pct = pctFor(mn, id);
                    return (
                      <div
                        key={side}
                        className={cn(
                          'px-2 py-1.5 truncate flex items-center justify-between gap-1',
                          i === 0 && 'border-b border-border/25',
                          resultSt ? STATUS_ROW[resultSt] : win && 'bg-emerald-500/12 text-emerald-300 font-semibold'
                        )}
                      >
                        <span className="truncate">{labelFor(mn, side, id)}</span>
                        <span className="flex items-center gap-1 shrink-0">
                          {pct !== null && (
                            <span
                              className="text-[9px] tabular-nums text-muted-foreground/70"
                              title={es ? `${pct}% de la liga eligió este equipo` : `${pct}% of the league picked this team`}
                            >
                              {pct}%
                            </span>
                          )}
                          {win && <PointsPill mn={mn} earned={st === 'earned'} />}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
        {/* Champion */}
        <div className="flex flex-col justify-center min-w-[120px]">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/[0.08] p-2 text-center">
            <div className="text-[9px] uppercase tracking-wider text-amber-500 font-bold">{es ? 'Campeón' : 'Champion'}</div>
            <div className="text-[12px] font-extrabold mt-0.5 truncate">
              {championId ? labelFor(104, 'home', championId) : '—'}
            </div>
          </div>
          {third && (
            <div className="mt-2 rounded-lg border border-border/40 bg-card/50 p-2 text-center">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground/80 font-bold">{es ? '3er' : '3rd'}</div>
              <div className="text-[11px] font-semibold mt-0.5 truncate">
                {picks[103]?.advancerTeamId ? labelFor(103, 'home', picks[103].advancerTeamId) : '—'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// (Bracket standings retired — superseded by the unified Leaderboard screen.)
