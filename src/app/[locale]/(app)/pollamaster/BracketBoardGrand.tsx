'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { HelpCircle, ChevronDown } from 'lucide-react';
import {
  BRACKET_BY_MATCH, ROUND_ORDER, parseFeed, ADVANCEMENT_POINTS_BY_MATCH,
  type KnockoutRound,
} from '@/lib/bracket';
import { knockoutSlotLabel } from '@/lib/bracket-slots';
import { Flag, isoFromEmoji } from '@/components/shared/Flag';
import { cn } from '@/lib/utils';
import type { BracketView, Team, Locale, BracketComparison, BonusView } from '@/lib/types';

/**
 * "El camino a la gloria" — the grand, read-only bracket view.
 * Presentation-only redesign of the ladder view in BracketBoard.tsx:
 * every derivation (statusOf / pctFor / sideTeam / peer viewing / deep
 * links) mirrors the live bracket screen exactly. No logic changes.
 */

interface BracketBoardGrandProps {
  initialBracket: BracketView;
  comparison?: BracketComparison;
  teams: Team[];
  bonus?: BonusView;
  locale: Locale;
}

type Pick = { advancerTeamId: string | null; homeScore: number | null; awayScore: number | null };
type PickStatus = 'earned' | 'dead' | 'pending' | null;

const ROUND_LABEL: Record<KnockoutRound, { es: string; en: string }> = {
  r32: { es: '32avos', en: 'Round of 32' },
  r16: { es: 'Octavos', en: 'Round of 16' },
  qf: { es: 'Cuartos', en: 'Quarterfinals' },
  sf: { es: 'Semis', en: 'Semifinals' },
  final: { es: 'Final', en: 'Final' },
  third_place: { es: '3.er puesto', en: 'Third place' },
};

// Big hero flag: flagcdn at a size worthy of a medallion (the shared Flag
// component caps at h20/h40 — too small for the champion ring).
const SUBDIVISION: Record<string, string> = { ENG: 'gb-eng', SCO: 'gb-sct', WAL: 'gb-wls' };
function HeroFlag({ team }: { team: Team }) {
  const [failed, setFailed] = React.useState(false);
  const iso = SUBDIVISION[team.code] ?? isoFromEmoji(team.flagEmoji);
  if (!iso || failed) return <span className="pmx-heroemoji">{team.flagEmoji}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w160/${iso}.png`}
      srcSet={`https://flagcdn.com/w320/${iso}.png 2x`}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      className="pmx-heroflag"
    />
  );
}

export function BracketBoardGrand({ initialBracket, comparison, teams, bonus, locale }: BracketBoardGrandProps) {
  const es = locale === 'es';

  // ---- Data derivations: identical to BracketBoard.tsx ----
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
      if (matchNumber === 103) return null; // 3rd-place game: neutral, no advancement points
      const w = ADVANCEMENT_POINTS_BY_MATCH[matchNumber];
      if (w && earnedSet.has(`${w}:${teamId}`)) return 'earned';
      const actual = comparison.actualAdvancers[matchNumber];
      if (actual !== undefined && actual !== teamId) return 'dead';
      if (eliminatedSet.has(teamId)) return 'dead';
      return 'pending';
    },
    [comparison, earnedSet, eliminatedSet]
  );

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

  // Whose bracket is on screen: yours, or a league-mate's (?peer= deep link).
  const [peerId, setPeerId] = React.useState<string | null>(null);
  const peerById = React.useMemo(
    () => new Map((comparison?.peers ?? []).map((p) => [p.userId, p])),
    [comparison]
  );
  const viewingPeer = peerId ? peerById.get(peerId) ?? null : null;
  const searchParams = useSearchParams();
  const didInitPeer = React.useRef(false);
  React.useEffect(() => {
    if (didInitPeer.current) return;
    const p = searchParams.get('peer');
    if (p && peerById.has(p)) setPeerId(p);
    didInitPeer.current = true;
  }, [searchParams, peerById]);

  const teamById = React.useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const matchByNumber = React.useMemo(
    () => new Map(initialBracket.matches.map((m) => [m.matchNumber, m])),
    [initialBracket.matches]
  );

  const myPicks = React.useMemo<Record<number, Pick>>(() => {
    const init: Record<number, Pick> = {};
    for (const m of initialBracket.matches) {
      init[m.matchNumber] = {
        advancerTeamId: m.myAdvancerTeamId,
        homeScore: m.myHomeScore,
        awayScore: m.myAwayScore,
      };
    }
    return init;
  }, [initialBracket.matches]);
  const peerPicks = React.useMemo<Record<number, Pick>>(() => {
    if (!viewingPeer) return {};
    const rec: Record<number, Pick> = {};
    for (const [mn, team] of Object.entries(viewingPeer.advancers)) {
      rec[Number(mn)] = { advancerTeamId: team, homeScore: null, awayScore: null };
    }
    return rec;
  }, [viewingPeer]);
  const picks = viewingPeer ? peerPicks : myPicks;

  // Resolve which team sits on a side of a match, per the displayed picks.
  const sideTeam = React.useCallback(
    (matchNumber: number, side: 'home' | 'away'): string | null => {
      const node = BRACKET_BY_MATCH[matchNumber];
      if (!node) return null;
      const ref = side === 'home' ? node.home : node.away;
      const feed = parseFeed(ref);
      if (!feed) {
        const mv = matchByNumber.get(matchNumber);
        return (side === 'home' ? mv?.homeTeamId : mv?.awayTeamId) ?? null;
      }
      const adv = picks[feed.match]?.advancerTeamId ?? null;
      if (feed.kind === 'W') return adv;
      if (!adv) return null;
      const fh = sideTeam(feed.match, 'home');
      const fa = sideTeam(feed.match, 'away');
      return adv === fh ? fa : adv === fa ? fh : null;
    },
    [picks, matchByNumber]
  );

  const actualAdvancerOf = (mn: number): string | null =>
    comparison?.actualAdvancers?.[mn] ?? null;

  const championId = picks[104]?.advancerTeamId ?? null;
  const thirdId = picks[103]?.advancerTeamId ?? null;
  const championTeam = championId ? teamById.get(championId) ?? null : null;
  const thirdTeam = thirdId ? teamById.get(thirdId) ?? null : null;
  const champStatus = statusOf(104, championId);

  // The golden road: walk the feeder graph back from the final, following
  // the displayed picks' champion, and light every match on the path.
  const roadSet = React.useMemo(() => {
    const s = new Set<number>();
    if (!championId) return s;
    let cur: number | null = 104;
    while (cur != null) {
      s.add(cur);
      const node = BRACKET_BY_MATCH[cur];
      if (!node) break;
      let next: number | null = null;
      for (const ref of [node.home, node.away]) {
        const feed = parseFeed(ref);
        if (feed?.kind === 'W' && picks[feed.match]?.advancerTeamId === championId) {
          next = feed.match;
          break;
        }
      }
      cur = next;
    }
    return s;
  }, [championId, picks]);

  // Header stats: the exact live values from the comparison (never invented).
  const mePeer = React.useMemo(
    () => (comparison?.peers ?? []).find((p) => p.isMe) ?? null,
    [comparison]
  );
  const shownStats = viewingPeer ?? mePeer;

  // The three pre-tournament picks (champion · boot · ball, locked June 11).
  const shownChampionId = viewingPeer ? viewingPeer.championTeamId : (bonus?.championTeamId ?? null);
  const shownBoot = viewingPeer ? viewingPeer.bootPick : (bonus?.topScorerNames?.[0]?.trim() || null);
  const shownBall = viewingPeer ? viewingPeer.ballPick : (bonus?.bestPlayerNames?.[0]?.trim() || null);
  const shownChampionTeam = shownChampionId ? teamById.get(shownChampionId) ?? null : null;

  const labelFor = (matchNumber: number, side: 'home' | 'away', teamId: string | null): React.ReactNode => {
    if (teamId) {
      const tm = teamById.get(teamId);
      if (!tm) return '—';
      return (
        <>
          <Flag code={tm.code} emoji={tm.flagEmoji} logoUrl={tm.logoUrl} className="pmx-fl" />
          <span className="pmx-nm">{es ? tm.nameEs : tm.nameEn}</span>
        </>
      );
    }
    return (
      <span className="pmx-nm pmx-tbd">
        {knockoutSlotLabel(matchNumber, side, locale) ?? (es ? 'Por definir' : 'TBD')}
      </span>
    );
  };

  const r32Ready = ROUND_ORDER[0].matches.some(
    (m) => matchByNumber.get(m)?.homeTeamId && matchByNumber.get(m)?.awayTeamId
  );

  const cols = ROUND_ORDER.filter((r) => r.round !== 'third_place');

  const heroLine = !championTeam
    ? (es ? 'Sin campeón elegido' : 'No champion picked')
    : champStatus === 'earned'
    ? (es ? '¡Tu campeón levantó la copa!' : 'Your champion lifted the cup!')
    : champStatus === 'dead'
    ? (es ? 'Tu campeón quedó eliminado' : 'Your champion was knocked out')
    : (es ? 'Tu campeón sigue vivo' : 'Your champion is still alive');

  return (
    <div className="pmx">
      <style>{PMX_CSS}</style>

      {/* HERO */}
      <section className="pmx-hero">
        <p className="pmx-eyebrow">
          {es ? 'Campeón del Mundo' : 'World Champion'} ·{' '}
          {viewingPeer
            ? (es ? `Pronóstico de ${viewingPeer.displayName}` : `${viewingPeer.displayName}’s call`)
            : (es ? 'Tu pronóstico' : 'Your call')}
        </p>

        <div className={cn('pmx-champ', champStatus === 'dead' && 'pmx-champ-dead')}>
          <div className="pmx-ring">
            {championTeam ? <HeroFlag team={championTeam} /> : <span className="pmx-heroemoji">🏆</span>}
          </div>
          <div className="pmx-plate">
            {championTeam ? (es ? championTeam.nameEs : championTeam.nameEn) : '—'}
            {championTeam && champStatus !== 'dead' && (
              <span className="pmx-shine" aria-hidden="true">
                {es ? championTeam.nameEs : championTeam.nameEn}
              </span>
            )}
          </div>
          <div className="pmx-who">
            {heroLine}
            {thirdTeam && (
              <small>
                {' '}· {es ? '3.er puesto' : '3rd place'}:{' '}
                <Flag code={thirdTeam.code} emoji={thirdTeam.flagEmoji} logoUrl={thirdTeam.logoUrl} className="pmx-fl-sm" />{' '}
                {es ? thirdTeam.nameEs : thirdTeam.nameEn}
              </small>
            )}
          </div>
        </div>

        {shownStats && (
          <div className="pmx-scoreline">
            <span><b>{shownStats.points}</b> <span className="pmx-u">{es ? 'pts llave' : 'bracket pts'}</span></span>
            <span><b>{shownStats.correctPicks}</b> <span className="pmx-u">{es ? 'aciertos' : 'hits'}</span></span>
            {champStatus === 'earned' ? (
              <span><b>+55</b> <span className="pmx-u">{es ? 'campeón 👑' : 'champion 👑'}</span></span>
            ) : (
              <span><b>{shownStats.alivePicks}</b> <span className="pmx-u">{es ? 'siguen vivos' : 'still alive'}</span></span>
            )}
          </div>
        )}

        {(shownChampionTeam || shownBoot || shownBall) && (
          <div className="pmx-picks">
            <div className="pmx-pick">
              <span className="pmx-ic">🏆</span>
              <div>
                <div className="pmx-k">{es ? 'Campeón' : 'Champion'}</div>
                <div className="pmx-v">
                  {shownChampionTeam ? (
                    <>
                      <Flag code={shownChampionTeam.code} emoji={shownChampionTeam.flagEmoji} logoUrl={shownChampionTeam.logoUrl} className="pmx-fl-sm" />
                      {es ? shownChampionTeam.nameEs : shownChampionTeam.nameEn}
                    </>
                  ) : '—'}
                </div>
              </div>
            </div>
            <div className="pmx-pick">
              <span className="pmx-ic">🥇</span>
              <div>
                <div className="pmx-k">{es ? 'Bota de Oro' : 'Golden Boot'}</div>
                <div className="pmx-v">{shownBoot ?? '—'}</div>
              </div>
            </div>
            <div className="pmx-pick">
              <span className="pmx-ic">⭐</span>
              <div>
                <div className="pmx-k">{es ? 'Balón de Oro' : 'Golden Ball'}</div>
                <div className="pmx-v">{shownBall ?? '—'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Peer selector — same behavior as the live bracket screen */}
        {compareReady && (
          <div className="pmx-peer">
            <span>{es ? 'Viendo' : 'Viewing'}</span>
            <div className="pmx-selwrap">
              <select
                value={peerId ?? '__me__'}
                onChange={(e) => setPeerId(e.target.value === '__me__' ? null : e.target.value)}
              >
                <option value="__me__">{es ? 'Tu llave' : 'Your bracket'}</option>
                {comparison!.peers.filter((p) => !p.isMe).map((p) => (
                  <option key={p.userId} value={p.userId}>{p.displayName} · {p.points} pts</option>
                ))}
              </select>
              <ChevronDown className="pmx-chev" aria-hidden="true" />
            </div>
            <Link href={`/${locale}/rules`} className="pmx-rules">
              <HelpCircle aria-hidden="true" />
              {es ? 'Cómo se puntúa' : 'How scoring works'}
            </Link>
          </div>
        )}
      </section>

      {!r32Ready && !initialBracket.locked ? (
        <div className="pmx-notopen">
          {es
            ? 'La llave se llena cuando terminen los grupos y se conozcan los 32 clasificados.'
            : 'The bracket opens once the groups finish and the 32 qualifiers are set.'}
        </div>
      ) : (
        <>
          {/* BRACKET */}
          <div className="pmx-boardhead">
            <h2>{es ? 'El camino a la gloria' : 'The road to glory'}</h2>
            <div className="pmx-legend">
              <span><i className="pmx-lg" />{es ? 'Acertado' : 'Hit'}</span>
              <span><i className="pmx-la" />{es ? 'Sigue vivo' : 'Still alive'}</span>
              <span><i className="pmx-ld" />{es ? 'Eliminado' : 'Out'}</span>
            </div>
          </div>

          <div className="pmx-scroller">
            <div className="pmx-rounds">
              {cols.map((r) => (
                <div key={r.round} className="pmx-col">
                  <div className="pmx-rlabel">{es ? ROUND_LABEL[r.round].es : ROUND_LABEL[r.round].en}</div>
                  {r.matches.map((mn) => {
                    const homeId = sideTeam(mn, 'home');
                    const awayId = sideTeam(mn, 'away');
                    const adv = picks[mn]?.advancerTeamId ?? null;
                    const onRoad = roadSet.has(mn);
                    return (
                      <div key={mn} className={cn('pmx-match', onRoad && 'pmx-road')}>
                        {(['home', 'away'] as const).map((side) => {
                          const id = side === 'home' ? homeId : awayId;
                          const win = !!id && adv === id;
                          const st = win ? statusOf(mn, id) : null;
                          const realAdv = actualAdvancerOf(mn);
                          const missedReal = !!id && !!realAdv && id === realAdv && !win;
                          const pct = pctFor(mn, id);
                          const pts = ADVANCEMENT_POINTS_BY_MATCH[mn];
                          const cls = win
                            ? st === 'earned' ? 'pmx-earned' : st === 'dead' ? 'pmx-dead' : 'pmx-alive'
                            : missedReal ? 'pmx-real' : '';
                          return (
                            <div key={side} className={cn('pmx-team', win && 'pmx-adv', cls)}>
                              {win && st === 'earned' && <span className="pmx-tick pmx-tick-g">★</span>}
                              {win && st === 'pending' && <span className="pmx-tick pmx-tick-a">✓</span>}
                              {win && st === 'dead' && <span className="pmx-tick pmx-tick-d">✕</span>}
                              {missedReal && <span className="pmx-tick pmx-tick-a">✓</span>}
                              {labelFor(mn, side, id)}
                              {win && st === 'earned' && !!pts && (
                                <span className="pmx-pill">+{pts}{mn === 104 ? '👑' : ''}</span>
                              )}
                              {pct !== null && (
                                <span
                                  className="pmx-pct"
                                  title={es ? `${pct}% de la liga eligió este equipo` : `${pct}% of the league picked this team`}
                                >
                                  {pct}%
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* FINALE COLUMN */}
              <div className="pmx-col pmx-finale">
                <div className="pmx-rlabel">{es ? 'Campeón' : 'Champion'}</div>
                <div className={cn('pmx-trophybox', champStatus === 'dead' && 'pmx-trophy-dead')}>
                  <div className="pmx-k">{es ? 'Campeón' : 'Champion'}</div>
                  <div className="pmx-t">
                    {championTeam ? (
                      <>
                        <Flag code={championTeam.code} emoji={championTeam.flagEmoji} logoUrl={championTeam.logoUrl} className="pmx-fl" />
                        {es ? championTeam.nameEs : championTeam.nameEn}
                        {champStatus === 'earned' && ' 👑'}
                      </>
                    ) : '—'}
                  </div>
                </div>
                <div className="pmx-thirdbox">
                  <div className="pmx-k">{es ? '3.er puesto' : '3rd place'}</div>
                  <div className="pmx-t">
                    {thirdTeam ? (
                      <>
                        <Flag code={thirdTeam.code} emoji={thirdTeam.flagEmoji} logoUrl={thirdTeam.logoUrl} className="pmx-fl-sm" />
                        {es ? thirdTeam.nameEs : thirdTeam.nameEn}
                      </>
                    ) : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="pmx-foot">
            {es
              ? 'Desliza para recorrer la llave · El hilo dorado marca el camino de tu campeón'
              : 'Swipe through the bracket · The golden thread traces your champion’s road'}
          </p>
        </>
      )}
    </div>
  );
}

// Scoped design system for the grand bracket ("El camino a la gloria").
// Single accent = trophy gold; green strictly = alive, rose strictly = out.
const PMX_CSS = `
.pmx{
  --pitch:#070A12; --surface:#0F1523; --surface2:#0C111C; --raise:#141C2E;
  --line:#1E2739; --line2:#2B3A55;
  --gold:#F2C452; --gold-soft:#F4D488; --gold-deep:#7A6220;
  --green:#41D699; --rose:#E06B7C;
  --tx:#EAF1F9; --mut:#8393AB; --fnt:#54617A;
  --serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",ui-serif,serif;
  --shadow:0 18px 50px -18px rgba(0,0,0,.75);
  color:var(--tx);
  background:
    radial-gradient(1200px 620px at 50% -8%, rgba(242,196,82,.16), transparent 60%),
    radial-gradient(900px 500px at 84% 8%, rgba(65,214,153,.07), transparent 60%),
    linear-gradient(180deg,#080C15 0%, var(--pitch) 40%, #05070D 100%);
  border:1px solid var(--line); border-radius:20px;
  padding:0 clamp(14px,3.4vw,40px) 40px; margin:0 -4px;
  -webkit-font-smoothing:antialiased;
}
.pmx .pmx-hero{position:relative;padding:clamp(30px,6vw,60px) 0 clamp(18px,3vw,28px);text-align:center}
.pmx .pmx-eyebrow{font-size:12px;letter-spacing:.42em;text-transform:uppercase;color:var(--gold-soft);font-weight:600;margin:0 0 clamp(14px,3vw,22px)}
.pmx .pmx-champ{position:relative;display:inline-flex;flex-direction:column;align-items:center;gap:10px;max-width:100%}
.pmx .pmx-ring{
  position:relative;width:clamp(112px,24vw,160px);aspect-ratio:1;border-radius:50%;
  display:grid;place-items:center;overflow:hidden;
  background:
    radial-gradient(circle at 50% 34%, rgba(242,196,82,.22), transparent 62%),
    conic-gradient(from 210deg, rgba(242,196,82,.05), rgba(242,196,82,.5), rgba(242,196,82,.05));
  box-shadow:0 0 0 1px rgba(242,196,82,.4) inset, 0 0 60px -8px rgba(242,196,82,.5);
}
.pmx .pmx-ring::after{content:"";position:absolute;inset:8px;border-radius:50%;box-shadow:0 0 0 1px rgba(242,196,82,.16) inset;pointer-events:none}
.pmx .pmx-heroflag{width:62%;height:auto;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.55)}
.pmx .pmx-heroemoji{font-size:clamp(56px,13vw,92px);line-height:1}
.pmx .pmx-plate{
  font-family:var(--serif);font-weight:700;
  font-size:clamp(38px,9vw,80px);line-height:.94;letter-spacing:.01em;
  background:linear-gradient(180deg,#FBE7B6 0%, var(--gold) 46%, #A9863A 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  text-wrap:balance;position:relative;padding:0 6px;
}
.pmx .pmx-shine{position:absolute;inset:0;padding:0 6px;
  background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.85) 50%,transparent 62%);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  transform:translateX(-120%);animation:pmx-sweep 5.5s ease-in-out 1.2s infinite}
@keyframes pmx-sweep{0%,72%{transform:translateX(-120%)}90%,100%{transform:translateX(120%)}}
.pmx .pmx-champ-dead .pmx-plate{filter:grayscale(.55) brightness(.8)}
.pmx .pmx-champ-dead .pmx-ring{filter:grayscale(.5);box-shadow:0 0 0 1px rgba(224,107,124,.35) inset,0 0 40px -10px rgba(224,107,124,.3)}
.pmx .pmx-who{font-size:clamp(14px,3.2vw,19px);font-weight:600;letter-spacing:.02em}
.pmx .pmx-who small{color:var(--mut);font-weight:500}
.pmx .pmx-champ-dead + * .pmx-who{color:var(--mut)}
.pmx .pmx-scoreline{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 26px;margin:clamp(18px,4vw,28px) auto 0;align-items:baseline}
.pmx .pmx-scoreline b{font-size:clamp(28px,6.5vw,42px);font-variant-numeric:tabular-nums;
  background:linear-gradient(180deg,#FBE7B6,var(--gold));-webkit-background-clip:text;background-clip:text;color:transparent}
.pmx .pmx-u{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--mut);font-weight:600}
.pmx .pmx-picks{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin:clamp(20px,4vw,28px) auto 0}
.pmx .pmx-pick{display:flex;align-items:center;gap:10px;border:1px solid var(--line2);text-align:left;
  background:linear-gradient(180deg,var(--raise),var(--surface2));
  border-radius:14px;padding:9px 15px 9px 11px;box-shadow:var(--shadow)}
.pmx .pmx-ic{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-size:15px;flex:none;
  background:rgba(242,196,82,.12);color:var(--gold-soft);border:1px solid rgba(242,196,82,.28)}
.pmx .pmx-k{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--fnt);font-weight:700}
.pmx .pmx-v{font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px}
.pmx .pmx-peer{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;margin-top:clamp(18px,3.4vw,26px);font-size:12px;color:var(--mut)}
.pmx .pmx-selwrap{position:relative}
.pmx .pmx-peer select{appearance:none;border:1px solid var(--line2);background:var(--surface2);color:var(--tx);
  border-radius:10px;padding:7px 30px 7px 12px;font-size:12px;font-weight:600;max-width:60vw}
.pmx .pmx-peer select:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.pmx .pmx-chev{position:absolute;right:9px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:var(--mut);pointer-events:none}
.pmx .pmx-rules{display:inline-flex;align-items:center;gap:5px;color:var(--gold-soft);font-weight:600}
.pmx .pmx-rules svg{width:13px;height:13px}
.pmx .pmx-notopen{margin:24px auto 40px;max-width:440px;text-align:center;color:var(--mut);font-size:13px;
  border:1px solid rgba(242,196,82,.3);background:rgba(242,196,82,.05);border-radius:14px;padding:22px}
.pmx .pmx-boardhead{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:clamp(26px,5vw,42px) 0 14px}
.pmx .pmx-boardhead h2{margin:0;font-size:13px;letter-spacing:.28em;text-transform:uppercase;color:var(--mut);font-weight:700}
.pmx .pmx-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--mut)}
.pmx .pmx-legend i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:6px;vertical-align:middle}
.pmx .pmx-lg{background:var(--gold)} .pmx .pmx-la{background:var(--green)} .pmx .pmx-ld{background:var(--rose)}
.pmx .pmx-scroller{overflow-x:auto;overflow-y:hidden;padding:6px 2px 18px;
  -webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;
  mask-image:linear-gradient(90deg,transparent,#000 22px,#000 calc(100% - 22px),transparent);
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 22px,#000 calc(100% - 22px),transparent)}
.pmx .pmx-rounds{display:flex;gap:clamp(18px,2.4vw,34px);min-width:max-content;padding-bottom:4px}
.pmx .pmx-col{display:flex;flex-direction:column;justify-content:space-around;gap:12px;min-width:186px;scroll-snap-align:start}
.pmx .pmx-rlabel{font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--fnt);font-weight:700;text-align:center;padding-bottom:2px}
.pmx .pmx-match{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:12px;overflow:hidden;
  background:linear-gradient(180deg,var(--surface),var(--surface2));box-shadow:0 10px 26px -20px rgba(0,0,0,.8)}
.pmx .pmx-road{box-shadow:0 0 0 1px rgba(242,196,82,.55),0 14px 34px -18px rgba(242,196,82,.5)}
.pmx .pmx-team{display:flex;align-items:center;gap:8px;padding:9px 11px;position:relative;font-size:13px}
.pmx .pmx-team + .pmx-team{border-top:1px solid var(--line)}
.pmx .pmx-fl{height:13px;width:auto;border-radius:2px;flex:none;box-shadow:0 1px 2px rgba(0,0,0,.5)}
.pmx .pmx-fl-sm{display:inline-block;height:11px;width:auto;border-radius:2px;vertical-align:-1px}
.pmx .pmx-nm{flex:1;min-width:0;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pmx .pmx-tbd{color:var(--fnt);font-weight:400;font-size:12px}
.pmx .pmx-pct{font-size:11px;color:var(--fnt);font-variant-numeric:tabular-nums;flex:none}
.pmx .pmx-pill{display:inline-flex;align-items:center;font-size:10px;font-weight:800;font-variant-numeric:tabular-nums;
  padding:2px 7px;border-radius:999px;letter-spacing:.02em;flex:none;
  background:rgba(242,196,82,.22);color:#FCE7A8;box-shadow:inset 0 0 0 1px rgba(242,196,82,.45)}
.pmx .pmx-tick{font-size:12px;width:12px;text-align:center;flex:none;line-height:1}
.pmx .pmx-tick-g{color:var(--gold)} .pmx .pmx-tick-a{color:var(--green)} .pmx .pmx-tick-d{color:var(--rose)}
.pmx .pmx-adv .pmx-nm{font-weight:700}
.pmx .pmx-earned{background:linear-gradient(90deg,rgba(242,196,82,.16),rgba(242,196,82,.05));color:#FBE6A6;box-shadow:inset 0 0 0 1px rgba(242,196,82,.5)}
.pmx .pmx-alive{background:linear-gradient(90deg,rgba(65,214,153,.14),rgba(65,214,153,.04))}
.pmx .pmx-alive .pmx-nm{color:#C7F6E4}
.pmx .pmx-dead{color:var(--fnt)}
.pmx .pmx-dead .pmx-nm{text-decoration:line-through;text-decoration-color:rgba(224,107,124,.6);color:var(--fnt)}
.pmx .pmx-real .pmx-nm{color:#9FE8C9;font-weight:600}
.pmx .pmx-finale{justify-content:center;min-width:190px}
.pmx .pmx-trophybox{border:1px solid rgba(242,196,82,.5);border-radius:14px;padding:16px;text-align:center;
  background:radial-gradient(120% 120% at 50% 0%,rgba(242,196,82,.14),transparent 70%),linear-gradient(180deg,var(--raise),var(--surface2));
  box-shadow:0 0 40px -14px rgba(242,196,82,.5)}
.pmx .pmx-trophy-dead{filter:grayscale(.4) brightness(.85)}
.pmx .pmx-trophybox .pmx-k{color:var(--gold-soft);letter-spacing:.22em}
.pmx .pmx-trophybox .pmx-t{font-family:var(--serif);font-size:22px;font-weight:700;margin-top:6px;display:flex;align-items:center;justify-content:center;gap:9px}
.pmx .pmx-trophybox .pmx-fl{height:16px}
.pmx .pmx-thirdbox{border:1px solid var(--line2);border-radius:12px;padding:11px;text-align:center;background:var(--surface2)}
.pmx .pmx-thirdbox .pmx-t{font-size:14px;font-weight:600;margin-top:4px;display:flex;align-items:center;justify-content:center;gap:7px}
.pmx .pmx-foot{text-align:center;color:var(--fnt);font-size:12px;margin-top:30px}
@media (prefers-reduced-motion:reduce){.pmx .pmx-shine{animation:none;display:none}}
@media (max-width:640px){.pmx .pmx-col{min-width:164px}.pmx .pmx-scoreline{gap:8px 20px}.pmx{margin:0 -8px;border-radius:16px}}
`;
