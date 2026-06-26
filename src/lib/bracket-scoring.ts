/**
 * Knockout-bracket scoring — ALL weights live in BRACKET_SCORING so they
 * can be tuned freely (the owner wants to play with them). Philosophy:
 * the bracket is the main event; points reward getting the SHAPE of the
 * tournament right (which teams reach each round), escalating so deep
 * picks dominate. A small exact-score bonus is seasoning, not the meal.
 *
 * Default max (per the owner's "~200 + 50 champion" target):
 *   advancement  R16 3×16=48, QF 6×8=48, SF 12×4=48, Final 24×2=48  = 192
 *   third place  25                                                  =  25
 *   exact-score  3 × (up to 32 games)                                = bonus
 *   ----------------------------------------------------------------------
 *   bracket ≈ 217 max, + champion 50 (scored via the separate pick).
 *
 * Champion is NOT scored here — it pays through the pre-tournament
 * champion pick (50) to avoid double counting; reaching the final still
 * pays the Final advancement points.
 */
export const BRACKET_SCORING = {
  /** Points per correctly-predicted team reaching each round. */
  advancement: {
    r16: 3,
    qf: 6,
    sf: 12,
    final: 24,
  },
  /** Correct third-place finisher (winner of match 103). */
  thirdPlace: 25,
  /** Per knockout game: correct matchup + winner + exact regulation score. */
  exactScore: 3,
  /** Multiplier applied to total group-stage points (dial to de-weight groups; 1 = unchanged). */
  groupWeight: 1,
};

export type BracketScoring = typeof BRACKET_SCORING;

// Which feeder matches' winners constitute "the teams that reached round X".
const FEEDERS = {
  r16: [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88], // → reach R16
  qf: [89, 90, 91, 92, 93, 94, 95, 96], // → reach QF
  sf: [97, 98, 99, 100], // → reach SF
  final: [101, 102], // → reach Final
} as const;

export interface EnrichedPick {
  match: number;
  advancerTeamId: string | null;   // team the player advances from this match
  predictedHomeTeamId: string | null;
  predictedAwayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
}

export interface RealMatchResult {
  match: number;
  winnerTeamId: string | null;     // who actually advanced (incl. penalties)
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
  thirdPlace: number;
  exactScore: number;
  total: number;
  correct: { r16: number; qf: number; sf: number; final: number };
}

const advancersFrom = (
  byMatch: Map<number, { advancerTeamId: string | null }>,
  matches: readonly number[]
): Set<string> => {
  const s = new Set<string>();
  for (const m of matches) {
    const a = byMatch.get(m)?.advancerTeamId;
    if (a) s.add(a);
  }
  return s;
};

/**
 * Pure scorer: a player's enriched bracket vs the real results.
 * Advancement is set-based (path-independent): you score for each team you
 * placed in a round that actually reached that round, regardless of how
 * the rest of your bracket fared.
 */
export function scoreBracket(
  picks: EnrichedPick[],
  real: RealMatchResult[],
  cfg: BracketScoring = BRACKET_SCORING
): BracketScoreBreakdown {
  const pickByMatch = new Map(picks.map((p) => [p.match, p]));
  const realByMatch = new Map(real.map((r) => [r.match, r]));

  const roundPts = (round: keyof typeof FEEDERS, per: number) => {
    const mine = advancersFrom(pickByMatch, FEEDERS[round]);
    const actual = advancersFrom(
      new Map(real.map((r) => [r.match, { advancerTeamId: r.winnerTeamId }])),
      FEEDERS[round]
    );
    let hits = 0;
    for (const t of mine) if (actual.has(t)) hits++;
    return { pts: hits * per, hits };
  };

  const r16 = roundPts('r16', cfg.advancement.r16);
  const qf = roundPts('qf', cfg.advancement.qf);
  const sf = roundPts('sf', cfg.advancement.sf);
  const final = roundPts('final', cfg.advancement.final);

  // Third place: winner of match 103.
  const myThird = pickByMatch.get(103)?.advancerTeamId ?? null;
  const realThird = realByMatch.get(103)?.winnerTeamId ?? null;
  const thirdPlace = myThird && realThird && myThird === realThird ? cfg.thirdPlace : 0;

  // Exact-score bonus: matchup + winner + exact regulation score all match.
  let exactScore = 0;
  for (const p of picks) {
    const r = realByMatch.get(p.match);
    if (!r) continue;
    if (
      p.predictedHomeTeamId && p.predictedAwayTeamId &&
      p.predictedHomeTeamId === r.homeTeamId &&
      p.predictedAwayTeamId === r.awayTeamId &&
      p.advancerTeamId && p.advancerTeamId === r.winnerTeamId &&
      p.homeScore != null && p.awayScore != null &&
      p.homeScore === r.homeScore && p.awayScore === r.awayScore
    ) {
      exactScore += cfg.exactScore;
    }
  }

  const total = r16.pts + qf.pts + sf.pts + final.pts + thirdPlace + exactScore;
  return {
    r16: r16.pts, qf: qf.pts, sf: sf.pts, final: final.pts,
    thirdPlace, exactScore, total,
    correct: { r16: r16.hits, qf: qf.hits, sf: sf.hits, final: final.hits },
  };
}
