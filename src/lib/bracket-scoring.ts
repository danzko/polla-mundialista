/**
 * Knockout scoring — faithful implementation of
 * `docs/wc2026_pool_scoring_spec.md` (v1.1). ALL weights live in
 * BRACKET_SCORING so the owner can tune them; the Postgres leaderboard view
 * mirrors these exact numbers (keep them in sync).
 *
 * Two distinct keyings (see spec §1):
 *   • Bracket advancement is scored on the round a team REACHES
 *     (R16, QF, SF, FINAL, CHAMPION).
 *   • Match bonuses (result, exact score) are scored on the round a match is
 *     PLAYED in (R32, R16, QF, SF, FINAL, THIRD).
 *
 * A perfect entry scores exactly 403 (bracket 307 + result 48 + exact 48).
 */

import { roundOf, type KnockoutRound } from './bracket';

export interface BracketScoring {
  /** Points per correctly-predicted team REACHING each round (spec §3.1). */
  advancement: { r16: number; qf: number; sf: number; final: number };
  /** The champion (winner of the final) — scored once, here (spec §3.1). */
  champion: number;
  /** Correct-result bonus: pred winner == actual winner, EXCLUDED in R32 (§3.2). */
  result: number;
  /** Exact-score bonus by round PLAYED (§3.3). */
  exact: { r32: number; r16: number; qf: number; sf: number; final: number; third_place: number };
  /**
   * Optional dedicated podium bonus for naming the 3rd-place team in the
   * bracket. Default 0 (the third-place MATCH already pays result+exact).
   */
  thirdPlaceTeam: number;
  /** Multiplier on total group-stage points (1 = unchanged). Owner's dial. */
  groupWeight: number;
}

/** Tunable weights. The Postgres leaderboard view mirrors these numbers. */
export const BRACKET_SCORING: BracketScoring = {
  advancement: { r16: 4, qf: 8, sf: 16, final: 30 },
  champion: 55,
  result: 3,
  exact: { r32: 2, r16: 1, qf: 1, sf: 1, final: 1, third_place: 1 },
  thirdPlaceTeam: 0,
  groupWeight: 1,
};

const RESULT_EXCLUDED_ROUNDS = new Set<KnockoutRound>(['r32']);

// ============================================================================
// Spec-canonical engine (matches docs/wc2026_pool_scoring_spec.md §4 exactly).
// This is the reference the leaderboard SQL and the test vectors agree with.
// ============================================================================

export type SpecRound = 'R32' | 'R16' | 'QF' | 'SF' | 'FINAL' | 'THIRD';

export interface ActualResults {
  advancers: {
    R16: string[];
    QF: string[];
    SF: string[];
    FINAL: string[];
    CHAMPION: string;
    /** Optional 3rd-place team, only used if thirdPlaceTeam bonus is enabled. */
    THIRD?: string;
  };
  matches: Array<{
    id: string;
    round: SpecRound;
    /** Goals at end of extra time, EXCLUDING shootout. Team-keyed. */
    goals: Record<string, number>;
    /** Advancing team (3rd-place finisher for THIRD), INCLUDING shootout. */
    winner: string;
  }>;
}

export interface Entry {
  bracket: {
    R16: string[];
    QF: string[];
    SF: string[];
    FINAL: string[];
    CHAMPION: string;
    THIRD?: string;
  };
  match_predictions: Array<{
    match_id: string;
    pred_winner?: string;
    pred_goals?: Record<string, number>;
  }>;
}

/** Team-keyed goal equality: identical keys AND identical integer values. */
function goalsEqual(a?: Record<string, number>, b?: Record<string, number>): boolean {
  if (!a || !b) return false;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!(k in b) || a[k] !== b[k]) return false;
  }
  return true;
}

const ADV_KEYS: Array<['R16' | 'QF' | 'SF' | 'FINAL', keyof BracketScoring['advancement']]> = [
  ['R16', 'r16'],
  ['QF', 'qf'],
  ['SF', 'sf'],
  ['FINAL', 'final'],
];

/**
 * Score one entry against the actual results — the canonical spec algorithm.
 * Returns a full breakdown so the UI can show where points came from.
 */
export function scoreEntry(
  entry: Entry,
  actual: ActualResults,
  cfg: BracketScoring = BRACKET_SCORING
) {
  let advancement = 0;
  for (const [specKey, cfgKey] of ADV_KEYS) {
    const want = new Set(actual.advancers[specKey]);
    const correct = (entry.bracket[specKey] ?? []).filter((t) => want.has(t)).length;
    advancement += correct * cfg.advancement[cfgKey];
  }
  const champion =
    entry.bracket.CHAMPION && entry.bracket.CHAMPION === actual.advancers.CHAMPION
      ? cfg.champion
      : 0;

  // Optional dedicated podium bonus (default off).
  const thirdPlaceTeam =
    cfg.thirdPlaceTeam && entry.bracket.THIRD && actual.advancers.THIRD &&
    entry.bracket.THIRD === actual.advancers.THIRD
      ? cfg.thirdPlaceTeam
      : 0;

  const preds = new Map(entry.match_predictions.map((mp) => [mp.match_id, mp]));
  let result = 0;
  let exact = 0;
  const EXACT_BY_SPEC: Record<SpecRound, number> = {
    R32: cfg.exact.r32,
    R16: cfg.exact.r16,
    QF: cfg.exact.qf,
    SF: cfg.exact.sf,
    FINAL: cfg.exact.final,
    THIRD: cfg.exact.third_place,
  };
  for (const m of actual.matches) {
    const mp = preds.get(m.id);
    if (!mp) continue;
    if (m.round !== 'R32' && mp.pred_winner && mp.pred_winner === m.winner) {
      result += cfg.result;
    }
    if (goalsEqual(mp.pred_goals, m.goals)) {
      exact += EXACT_BY_SPEC[m.round];
    }
  }

  const knockoutPoints = advancement + champion + thirdPlaceTeam + result + exact;
  return {
    advancement,
    champion,
    thirdPlaceTeam,
    result,
    exact,
    /** Everything from the knockout phase — used as the tiebreaker. */
    knockoutPoints,
    total: knockoutPoints,
  };
}

// ============================================================================
// Per-match adapter — operates on the app's storage shape (one row per KO
// match: a predicted advancer + a predicted scoreline + the predicted/real
// matchup). Reuses the canonical engine so behaviour can't drift.
// ============================================================================

/** Round REACHED → the feeder match numbers whose winners reach it. */
export const FEEDERS = {
  r16: [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88],
  qf: [89, 90, 91, 92, 93, 94, 95, 96],
  sf: [97, 98, 99, 100],
  final: [101, 102],
} as const;
export const CHAMPION_FEEDER = 104;
export const THIRD_PLACE_MATCH = 103;

export interface EnrichedPick {
  match: number;
  advancerTeamId: string | null;
  predictedHomeTeamId: string | null;
  predictedAwayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
}

export interface RealMatchResult {
  match: number;
  winnerTeamId: string | null; // advanced team (incl. penalties)
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
}

export interface BracketScoreBreakdown {
  r16: number;
  qf: number;
  sf: number;
  final: number;
  champion: number;
  result: number;
  exactScore: number;
  /** Sum of all knockout points — the tiebreaker. */
  knockoutPoints: number;
  total: number;
  correct: { r16: number; qf: number; sf: number; final: number; champion: boolean };
}

const advancerSet = (rows: Map<number, { adv: string | null }>, matches: readonly number[]) => {
  const s = new Set<string>();
  for (const m of matches) {
    const a = rows.get(m)?.adv;
    if (a) s.add(a);
  }
  return s;
};

/**
 * Score a player's per-match knockout picks against the real results.
 * Advancement is path-independent set intersection (spec §3.1). Result and
 * exact bonuses are per actual match (spec §3.2/§3.3). The third-place match
 * (103) pays result+exact only — never advancement.
 */
export function scoreBracket(
  picks: EnrichedPick[],
  real: RealMatchResult[],
  cfg: BracketScoring = BRACKET_SCORING
): BracketScoreBreakdown {
  const myAdv = new Map(picks.map((p) => [p.match, { adv: p.advancerTeamId }]));
  const realAdv = new Map(real.map((r) => [r.match, { adv: r.winnerTeamId }]));

  const roundPts = (round: keyof typeof FEEDERS, per: number) => {
    const mine = advancerSet(myAdv, FEEDERS[round]);
    const actual = advancerSet(realAdv, FEEDERS[round]);
    let hits = 0;
    for (const t of mine) if (actual.has(t)) hits++;
    return { pts: hits * per, hits };
  };

  const r16 = roundPts('r16', cfg.advancement.r16);
  const qf = roundPts('qf', cfg.advancement.qf);
  const sf = roundPts('sf', cfg.advancement.sf);
  const final = roundPts('final', cfg.advancement.final);

  const myChamp = myAdv.get(CHAMPION_FEEDER)?.adv ?? null;
  const realChamp = realAdv.get(CHAMPION_FEEDER)?.adv ?? null;
  const championHit = !!myChamp && myChamp === realChamp;
  const champion = championHit ? cfg.champion : 0;

  // Match bonuses (result + exact), per actual match, including THIRD (103).
  const realByMatch = new Map(real.map((r) => [r.match, r]));
  let result = 0;
  let exactScore = 0;
  const exactByRound: Record<KnockoutRound, number> = cfg.exact;
  for (const p of picks) {
    const r = realByMatch.get(p.match);
    if (!r) continue;
    const round = roundOf(p.match);

    if (!RESULT_EXCLUDED_ROUNDS.has(round) && p.advancerTeamId && p.advancerTeamId === r.winnerTeamId) {
      result += cfg.result;
    }
    // Team-keyed exact score (orientation-safe).
    if (
      p.predictedHomeTeamId && p.predictedAwayTeamId &&
      r.homeTeamId && r.awayTeamId &&
      p.homeScore != null && p.awayScore != null &&
      r.homeScore != null && r.awayScore != null
    ) {
      const pg: Record<string, number> = { [p.predictedHomeTeamId]: p.homeScore, [p.predictedAwayTeamId]: p.awayScore };
      const rg: Record<string, number> = { [r.homeTeamId]: r.homeScore, [r.awayTeamId]: r.awayScore };
      if (goalsEqual(pg, rg)) exactScore += exactByRound[round];
    }
  }

  const knockoutPoints = r16.pts + qf.pts + sf.pts + final.pts + champion + result + exactScore;
  return {
    r16: r16.pts, qf: qf.pts, sf: sf.pts, final: final.pts, champion,
    result, exactScore, knockoutPoints, total: knockoutPoints,
    correct: { r16: r16.hits, qf: qf.hits, sf: sf.hits, final: final.hits, champion: championHit },
  };
}
