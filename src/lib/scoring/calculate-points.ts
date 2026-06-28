/**
 * Polla Mundialista 2026 - Match scoring helper
 *
 * ⚠️ The Postgres `leaderboard_view` (migrations 0018/0020/0022) is the SINGLE
 * SOURCE OF TRUTH for all scoring — group, knockout, advancement, and bonus
 * picks. This file is NOT that authority. It exists only to compute the
 * per-match "points earned" pill shown in the matches feed, and to keep that
 * one number unit-tested.
 *
 * Live rule (June 28 2026): EVERY match — group AND knockout — scores the same:
 *   - Exact score:           6 pts
 *   - Correct result only:   2 pts
 *   - Wrong result:          0 pts
 * There is no knockout multiplier and no special knockout bonus (both were
 * removed by group decision). Advancement points and the champion/boot/ball
 * bonuses live entirely in the SQL view — never here.
 */

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
  totalPoints: number;
  predictionType: PredictionType;
}

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
 * Points for a single match prediction (6 exact / 2 result / 0 wrong),
 * identical for every stage. Mirrors the scoreline scoring in leaderboard_view.
 */
export function calculateMatchPoints(
  prediction: MatchPrediction,
  actual: MatchActual
): MatchPointResult {
  const isExact =
    prediction.homeScore === actual.homeScore &&
    prediction.awayScore === actual.awayScore;

  const isCorrectResult =
    getResult(prediction.homeScore, prediction.awayScore) ===
    getResult(actual.homeScore, actual.awayScore);

  if (isExact) return { totalPoints: 6, predictionType: "exact" };
  if (isCorrectResult) return { totalPoints: 2, predictionType: "result" };
  return { totalPoints: 0, predictionType: "wrong" };
}
