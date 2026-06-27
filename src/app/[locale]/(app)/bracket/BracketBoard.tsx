'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Lock, Trophy, Check, LayoutList, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScoreStepper } from '@/components/predictions/ScoreStepper';
import { submitBracket } from '@/lib/api';
import {
  BRACKET_BY_MATCH, ROUND_ORDER, parseFeed, type KnockoutRound,
} from '@/lib/bracket';
import { knockoutSlotLabel } from '@/lib/bracket-slots';
import { cn } from '@/lib/utils';
import type { BracketView, BracketMatchView, Team, Locale } from '@/lib/types';

interface BracketBoardProps {
  initialBracket: BracketView;
  teams: Team[];
  locale: Locale;
  myUserId?: string;
}

type Pick = { advancerTeamId: string | null; homeScore: number | null; awayScore: number | null };

const ROUND_LABEL: Record<KnockoutRound, { es: string; en: string }> = {
  r32: { es: '32avos', en: 'Round of 32' },
  r16: { es: 'Octavos', en: 'Round of 16' },
  qf: { es: 'Cuartos', en: 'Quarterfinals' },
  sf: { es: 'Semifinal', en: 'Semifinals' },
  final: { es: 'Final', en: 'Final' },
  third_place: { es: '3er Puesto', en: 'Third place' },
};

export function BracketBoard({ initialBracket, teams, locale, myUserId }: BracketBoardProps) {
  const t = useTranslations();
  const es = locale === 'es';

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
  const [view, setView] = React.useState<'fill' | 'ladder'>('fill');
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  const locked = initialBracket.locked;

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

  const labelFor = (matchNumber: number, side: 'home' | 'away', teamId: string | null) => {
    if (teamId) {
      const tm = teamById.get(teamId);
      return tm ? `${tm.flagEmoji} ${es ? tm.nameEs : tm.nameEn}` : '—';
    }
    return knockoutSlotLabel(matchNumber, side, locale) ?? (es ? 'Por definir' : 'TBD');
  };

  // After changing an advancer, clear any downstream pick whose advancer is
  // no longer one of that match's (re-derived) participants.
  const setAdvancer = (matchNumber: number, teamId: string) => {
    if (locked) return;
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

  const setScore = (matchNumber: number, side: 'home' | 'away', value: number) => {
    if (locked) return;
    setPicks((prev) => ({
      ...prev,
      [matchNumber]: {
        ...prev[matchNumber],
        homeScore: side === 'home' ? value : prev[matchNumber]?.homeScore ?? 0,
        awayScore: side === 'away' ? value : prev[matchNumber]?.awayScore ?? 0,
      },
    }));
  };

  const round = ROUND_ORDER[roundIdx];
  const roundGames = round.matches;
  const chosenInRound = roundGames.filter((m) => picks[m]?.advancerTeamId).length;

  const championId = picks[104]?.advancerTeamId ?? null;

  const handleSave = async () => {
    setSaving(true);
    setToast(null);
    const payload = initialBracket.matches
      .map((m) => {
        const p = picks[m.matchNumber];
        return p && (p.advancerTeamId || p.homeScore != null || p.awayScore != null)
          ? { matchId: m.matchId, advancerTeamId: p.advancerTeamId, homeScore: p.homeScore, awayScore: p.awayScore }
          : null;
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
    <div className="pb-28">
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
        </div>
        <button
          onClick={() => setView((v) => (v === 'fill' ? 'ladder' : 'fill'))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground"
        >
          {view === 'fill' ? <GitBranch className="h-3.5 w-3.5" /> : <LayoutList className="h-3.5 w-3.5" />}
          {view === 'fill' ? (es ? 'Ver llave' : 'View bracket') : (es ? 'Llenar' : 'Fill in')}
        </button>
      </div>

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
      ) : view === 'ladder' ? (
        <LadderView
          rounds={ROUND_ORDER}
          sideTeam={sideTeam}
          labelFor={labelFor}
          picks={picks}
          championId={championId}
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

          <div className="mb-2 text-[11px] text-muted-foreground">
            {locked
              ? (es ? 'Llave cerrada — solo lectura' : 'Bracket locked — read only')
              : (es ? `Toca quién avanza · ${chosenInRound}/${roundGames.length} listos` : `Tap who advances · ${chosenInRound}/${roundGames.length} set`)}
          </div>

          {/* GAMES IN ROUND */}
          <div className="space-y-2.5">
            {roundGames.map((mn) => {
              const homeId = sideTeam(mn, 'home');
              const awayId = sideTeam(mn, 'away');
              const p = picks[mn] ?? { advancerTeamId: null, homeScore: null, awayScore: null };
              const ready = !!homeId && !!awayId;
              return (
                <div key={mn} className="rounded-xl border border-border/45 bg-card/50 overflow-hidden">
                  <div className="px-2.5 py-1 text-[10px] text-muted-foreground/80 bg-secondary/40">
                    {es ? 'Partido' : 'Match'} {mn}
                    {!ready && <span className="ml-1.5">· {es ? 'esperando equipos' : 'awaiting teams'}</span>}
                  </div>
                  {(['home', 'away'] as const).map((side, idx) => {
                    const teamId = side === 'home' ? homeId : awayId;
                    const isWinner = !!teamId && p.advancerTeamId === teamId;
                    return (
                      <div
                        key={side}
                        className={cn(
                          'flex items-center justify-between gap-2 px-2.5 py-2',
                          idx === 0 && 'border-b border-border/30',
                          isWinner && 'bg-emerald-500/12'
                        )}
                      >
                        <button
                          disabled={!ready || locked}
                          onClick={() => teamId && setAdvancer(mn, teamId)}
                          className={cn(
                            'flex items-center gap-2 min-w-0 text-[13px] text-left',
                            isWinner ? 'font-bold text-emerald-300' : 'text-foreground',
                            (!ready || locked) && 'cursor-default'
                          )}
                        >
                          {ready && !locked && (
                            <span className={cn('shrink-0', isWinner ? 'text-emerald-400' : 'text-muted-foreground/40')}>
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          )}
                          <span className="truncate">{labelFor(mn, side, teamId)}</span>
                        </button>
                        <div className="shrink-0 scale-90 origin-right">
                          <ScoreStepper
                            value={(side === 'home' ? p.homeScore : p.awayScore) ?? 0}
                            onChange={(v) => setScore(mn, side, v)}
                            disabled={!ready || locked}
                          />
                        </div>
                      </div>
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
  rounds, sideTeam, labelFor, picks, championId, es,
}: {
  rounds: typeof ROUND_ORDER;
  sideTeam: (m: number, s: 'home' | 'away') => string | null;
  labelFor: (m: number, s: 'home' | 'away', id: string | null) => string;
  picks: Record<number, Pick>;
  championId: string | null;
  es: boolean;
}) {
  // Order columns left→right; put third-place last as a small aside.
  const cols = rounds.filter((r) => r.round !== 'third_place');
  const third = rounds.find((r) => r.round === 'third_place');
  return (
    <div className="overflow-x-auto scrollbar-none -mx-1 px-1">
      <div className="flex gap-3 min-w-max items-stretch">
        {cols.map((r) => (
          <div key={r.round} className="flex flex-col justify-around gap-2 min-w-[148px]">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-bold text-center">
              {es ? ROUND_LABEL[r.round].es : ROUND_LABEL[r.round].en}
            </div>
            {r.matches.map((mn) => {
              const homeId = sideTeam(mn, 'home');
              const awayId = sideTeam(mn, 'away');
              const adv = picks[mn]?.advancerTeamId ?? null;
              return (
                <div key={mn} className="rounded-lg border border-border/40 bg-card/50 overflow-hidden text-[11px]">
                  {(['home', 'away'] as const).map((side, i) => {
                    const id = side === 'home' ? homeId : awayId;
                    const win = !!id && adv === id;
                    return (
                      <div key={side} className={cn('px-2 py-1.5 truncate', i === 0 && 'border-b border-border/25', win && 'bg-emerald-500/12 text-emerald-300 font-semibold')}>
                        {labelFor(mn, side, id)}
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
