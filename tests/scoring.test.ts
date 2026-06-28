/**
 * Match-scoring helper tests (the per-match "points earned" pill).
 *
 * The authority for all scoring is the Postgres leaderboard_view; this only
 * covers calculateMatchPoints (6/2/0, identical for every stage). Bracket /
 * advancement / bonus scoring is tested in tests/bracket-scoring.test.ts and
 * verified directly against the SQL view.
 *
 * Run with: npx vitest run tests/scoring.test.ts
 */

import { describe, it, expect } from "vitest";
import { calculateMatchPoints } from "../src/lib/scoring/calculate-points";

describe("calculateMatchPoints (6/2/0, same for every stage)", () => {
  it("awards 6 pts for exact score", () => {
    const result = calculateMatchPoints(
      { homeScore: 2, awayScore: 1 },
      { homeScore: 2, awayScore: 1 }
    );
    expect(result.totalPoints).toBe(6);
    expect(result.predictionType).toBe("exact");
  });

  it("awards 6 pts for exact 0-0 draw", () => {
    const result = calculateMatchPoints(
      { homeScore: 0, awayScore: 0 },
      { homeScore: 0, awayScore: 0 }
    );
    expect(result.totalPoints).toBe(6);
    expect(result.predictionType).toBe("exact");
  });

  it("awards 2 pts for correct result, wrong score (home win)", () => {
    const result = calculateMatchPoints(
      { homeScore: 3, awayScore: 1 },
      { homeScore: 1, awayScore: 0 }
    );
    expect(result.totalPoints).toBe(2);
    expect(result.predictionType).toBe("result");
  });

  it("awards 2 pts for correct result, wrong score (away win)", () => {
    const result = calculateMatchPoints(
      { homeScore: 0, awayScore: 2 },
      { homeScore: 1, awayScore: 3 }
    );
    expect(result.totalPoints).toBe(2);
    expect(result.predictionType).toBe("result");
  });

  it("awards 2 pts for correct draw, wrong score", () => {
    const result = calculateMatchPoints(
      { homeScore: 1, awayScore: 1 },
      { homeScore: 2, awayScore: 2 }
    );
    expect(result.totalPoints).toBe(2);
    expect(result.predictionType).toBe("result");
  });

  it("awards 0 pts for wrong result (predicted home win, actual draw)", () => {
    const result = calculateMatchPoints(
      { homeScore: 2, awayScore: 1 },
      { homeScore: 1, awayScore: 1 }
    );
    expect(result.totalPoints).toBe(0);
    expect(result.predictionType).toBe("wrong");
  });

  it("awards 0 pts for wrong result (predicted draw, actual away win)", () => {
    const result = calculateMatchPoints(
      { homeScore: 1, awayScore: 1 },
      { homeScore: 0, awayScore: 2 }
    );
    expect(result.totalPoints).toBe(0);
    expect(result.predictionType).toBe("wrong");
  });

  it("awards 0 pts for completely wrong (predicted home, actual away)", () => {
    const result = calculateMatchPoints(
      { homeScore: 3, awayScore: 0 },
      { homeScore: 0, awayScore: 1 }
    );
    expect(result.totalPoints).toBe(0);
    expect(result.predictionType).toBe("wrong");
  });

  it("handles high scores correctly", () => {
    const result = calculateMatchPoints(
      { homeScore: 7, awayScore: 1 },
      { homeScore: 7, awayScore: 1 }
    );
    expect(result.totalPoints).toBe(6);
  });

  it("handles 0-0 predictions vs non-zero actual correctly", () => {
    const result = calculateMatchPoints(
      { homeScore: 0, awayScore: 0 },
      { homeScore: 1, awayScore: 0 }
    );
    expect(result.totalPoints).toBe(0); // draw vs home win
  });
});
