/**
 * Polla Mundialista 2026 - Scoring Engine
 *
 * Pure functions for calculating prediction points.
 * These mirror the Postgres leaderboard_view logic exactly.
 * Used for: client-side optimistic display, unit testing, future SSR.
 *
 * Scoring rules (PRD v2):
 *   - Exact score: 6 pts
 *   - Correct result, wrong score: 2 pts
 *   - Wrong result: 0 pts
 *   - Knockout multiplier (R32+): x2
 *   - Bonuses: champion 15, runner-up 10, 3rd place 5,
 *     semifinalists 3 each (max 12), Golden Boot 10, Golden Ball 10
 */

export type MatchStage =
  | "group"
  | "r32"
  | "r16"
  | "qf"
  | "sf"
  | "third_place"
  | "final";

export type PredictionType = "exact" | "result" | "wrong";

export interface MatchPrediction {
  homeScore: number;
  awayScore: number;
}

export interface MatchActual {
  homeScore: number;
  awayScore: number;
}

export interface MatchPointResult {
  basePoints: number;
  multiplier: number;
  totalPoints: number;
  predictionType: PredictionType;
}

// ============================================================
// Core scoring
// ============================================================

const KNOCKOUT_STAGES: MatchStage[] = [
  "r32",
  "r16",
  "qf",
  "sf",
  "third_place",
  "final",
];

/**
 * Determine the result category of a score: 'home_win' | 'away_win' | 'draw'
 */
function getResult(
  home: number,
  away: number
): "home_win" | "away_win" | "draw" {
  if (home > away) return "home_win";
  if (home < away) return "away_win";
  return "draw";
}

/**
 * Calculate points for a single match prediction.
 */
export function calculateMatchPoints(
  prediction: MatchPrediction,
  actual: MatchActual,
  stage: MatchStage
): MatchPointResult {
  const isExact =
    prediction.homeScore === actual.homeScore &&
    prediction.awayScore === actual.awayScore;

  const predResult = getResult(prediction.homeScore, prediction.awayScore);
  const actualResult = getResult(actual.homeScore, actual.awayScore);
  const isCorrectResult = predResult === actualResult;

  let basePoints: number;
  let predictionType: PredictionType;

  if (isExact) {
    basePoints = 6;
    predictionType = "exact";
  } else if (isCorrectResult) {
    basePoints = 2;
    predictionType = "result";
  } else {
    basePoints = 0;
    predictionType = "wrong";
  }

  const multiplier = KNOCKOUT_STAGES.includes(stage) ? 2 : 1;

  return {
    basePoints,
    multiplier,
    totalPoints: basePoints * multiplier,
    predictionType,
  };
}

// ============================================================
// Bonus scoring
// ============================================================

export interface BonusPrediction {
  championTeamId: string | null;
  runnerUpTeamId: string | null;
  thirdPlaceTeamId: string | null;
  semifinalists: string[] | null; // array of 4 team IDs
  topScorerName: string | null;
  bestPlayerName: string | null;
}

export interface TournamentActuals {
  championTeamId: string;
  runnerUpTeamId: string;
  thirdPlaceTeamId: string;
  semifinalistTeamIds: string[]; // the 4 semifinalists
  topScorerName: string; // normalized for comparison
  bestPlayerName: string; // normalized for comparison
}

export interface BonusPointResult {
  champion: number;
  runnerUp: number;
  thirdPlace: number;
  semifinalists: number;
  topScorer: number;
  bestPlayer: number;
  total: number;
}

/**
 * Normalize a player name for fuzzy comparison.
 * Strips accents, lowercases, trims whitespace.
 */
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Calculate bonus prediction points.
 */
export function calculateBonusPoints(
  prediction: BonusPrediction,
  actuals: TournamentActuals
): BonusPointResult {
  const champion =
    prediction.championTeamId === actuals.championTeamId ? 15 : 0;
  const runnerUp =
    prediction.runnerUpTeamId === actuals.runnerUpTeamId ? 10 : 0;
  const thirdPlace =
    prediction.thirdPlaceTeamId === actuals.thirdPlaceTeamId ? 5 : 0;

  // Each correctly picked semifinalist: 3 pts (max 12)
  let semifinalists = 0;
  if (prediction.semifinalists && actuals.semifinalistTeamIds) {
    const actualSet = new Set(actuals.semifinalistTeamIds);
    for (const teamId of prediction.semifinalists) {
      if (actualSet.has(teamId)) {
        semifinalists += 3;
      }
    }
  }

  const topScorer =
    prediction.topScorerName &&
    normalizeName(prediction.topScorerName) ===
      normalizeName(actuals.topScorerName)
      ? 10
      : 0;

  const bestPlayer =
    prediction.bestPlayerName &&
    normalizeName(prediction.bestPlayerName) ===
      normalizeName(actuals.bestPlayerName)
      ? 10
      : 0;

  return {
    champion,
    runnerUp,
    thirdPlace,
    semifinalists,
    topScorer,
    bestPlayer,
    total: champion + runnerUp + thirdPlace + semifinalists + topScorer + bestPlayer,
  };
}

// ============================================================
// Leaderboard aggregation
// ============================================================

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  totalPoints: number;
  exactCount: number;
  resultCount: number;
  wrongCount: number;
  bonusPoints: number;
  firstPredictionAt: Date | null;
}

/**
 * Sort leaderboard entries by tiebreaker rules:
 * 1. Total points (desc)
 * 2. Exact score count (desc)
 * 3. Correct result count (desc)
 * 4. Earliest first prediction (asc)
 */
export function sortLeaderboard(
  entries: LeaderboardEntry[]
): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    // 1. Total points
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    // 2. Exact count
    if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
    // 3. Result count
    if (b.resultCount !== a.resultCount) return b.resultCount - a.resultCount;
    // 4. Earliest first prediction
    const aTime = a.firstPredictionAt?.getTime() ?? Infinity;
    const bTime = b.firstPredictionAt?.getTime() ?? Infinity;
    return aTime - bTime;
  });
}
