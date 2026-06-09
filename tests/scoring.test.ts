/**
 * Scoring engine unit tests
 *
 * Run with: npx vitest run tests/scoring.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  calculateMatchPoints,
  calculateBonusPoints,
  sortLeaderboard,
  type LeaderboardEntry,
} from "../src/lib/scoring/calculate-points";

// ============================================================
// calculateMatchPoints
// ============================================================

describe("calculateMatchPoints", () => {
  describe("group stage (x1 multiplier)", () => {
    it("awards 6 pts for exact score", () => {
      const result = calculateMatchPoints(
        { homeScore: 2, awayScore: 1 },
        { homeScore: 2, awayScore: 1 },
        "group"
      );
      expect(result.totalPoints).toBe(6);
      expect(result.predictionType).toBe("exact");
      expect(result.multiplier).toBe(1);
    });

    it("awards 6 pts for exact 0-0 draw", () => {
      const result = calculateMatchPoints(
        { homeScore: 0, awayScore: 0 },
        { homeScore: 0, awayScore: 0 },
        "group"
      );
      expect(result.totalPoints).toBe(6);
      expect(result.predictionType).toBe("exact");
    });

    it("awards 2 pts for correct result, wrong score (home win)", () => {
      const result = calculateMatchPoints(
        { homeScore: 3, awayScore: 1 },
        { homeScore: 1, awayScore: 0 },
        "group"
      );
      expect(result.totalPoints).toBe(2);
      expect(result.predictionType).toBe("result");
    });

    it("awards 2 pts for correct result, wrong score (away win)", () => {
      const result = calculateMatchPoints(
        { homeScore: 0, awayScore: 2 },
        { homeScore: 1, awayScore: 3 },
        "group"
      );
      expect(result.totalPoints).toBe(2);
      expect(result.predictionType).toBe("result");
    });

    it("awards 2 pts for correct draw, wrong score", () => {
      const result = calculateMatchPoints(
        { homeScore: 1, awayScore: 1 },
        { homeScore: 2, awayScore: 2 },
        "group"
      );
      expect(result.totalPoints).toBe(2);
      expect(result.predictionType).toBe("result");
    });

    it("awards 0 pts for wrong result (predicted home win, actual draw)", () => {
      const result = calculateMatchPoints(
        { homeScore: 2, awayScore: 1 },
        { homeScore: 1, awayScore: 1 },
        "group"
      );
      expect(result.totalPoints).toBe(0);
      expect(result.predictionType).toBe("wrong");
    });

    it("awards 0 pts for wrong result (predicted draw, actual away win)", () => {
      const result = calculateMatchPoints(
        { homeScore: 1, awayScore: 1 },
        { homeScore: 0, awayScore: 2 },
        "group"
      );
      expect(result.totalPoints).toBe(0);
      expect(result.predictionType).toBe("wrong");
    });

    it("awards 0 pts for completely wrong (predicted home, actual away)", () => {
      const result = calculateMatchPoints(
        { homeScore: 3, awayScore: 0 },
        { homeScore: 0, awayScore: 1 },
        "group"
      );
      expect(result.totalPoints).toBe(0);
      expect(result.predictionType).toBe("wrong");
    });
  });

  describe("knockout stages (x2 multiplier)", () => {
    const knockoutStages = [
      "r32",
      "r16",
      "qf",
      "sf",
      "third_place",
      "final",
    ] as const;

    for (const stage of knockoutStages) {
      it(`awards 12 pts for exact score in ${stage}`, () => {
        const result = calculateMatchPoints(
          { homeScore: 1, awayScore: 0 },
          { homeScore: 1, awayScore: 0 },
          stage
        );
        expect(result.totalPoints).toBe(12);
        expect(result.multiplier).toBe(2);
        expect(result.basePoints).toBe(6);
      });

      it(`awards 4 pts for correct result in ${stage}`, () => {
        const result = calculateMatchPoints(
          { homeScore: 2, awayScore: 0 },
          { homeScore: 3, awayScore: 1 },
          stage
        );
        expect(result.totalPoints).toBe(4);
        expect(result.multiplier).toBe(2);
      });

      it(`awards 0 pts for wrong result in ${stage}`, () => {
        const result = calculateMatchPoints(
          { homeScore: 2, awayScore: 0 },
          { homeScore: 0, awayScore: 1 },
          stage
        );
        expect(result.totalPoints).toBe(0);
      });
    }
  });

  describe("edge cases", () => {
    it("handles high scores correctly", () => {
      const result = calculateMatchPoints(
        { homeScore: 7, awayScore: 1 },
        { homeScore: 7, awayScore: 1 },
        "group"
      );
      expect(result.totalPoints).toBe(6);
    });

    it("handles 0-0 predictions vs non-zero actual correctly", () => {
      const result = calculateMatchPoints(
        { homeScore: 0, awayScore: 0 },
        { homeScore: 1, awayScore: 0 },
        "group"
      );
      expect(result.totalPoints).toBe(0); // draw vs home win
    });
  });
});

// ============================================================
// calculateBonusPoints
// ============================================================

describe("calculateBonusPoints", () => {
  const actuals = {
    championTeamId: "team-arg",
    runnerUpTeamId: "team-fra",
    thirdPlaceTeamId: "team-bra",
    semifinalistTeamIds: ["team-arg", "team-fra", "team-bra", "team-eng"],
    topScorerName: "Lionel Messi",
    bestPlayerName: "Kylian Mbappe",
  };

  it("awards max points for perfect prediction", () => {
    const result = calculateBonusPoints(
      {
        championTeamId: "team-arg",
        runnerUpTeamId: "team-fra",
        thirdPlaceTeamId: "team-bra",
        semifinalists: ["team-arg", "team-fra", "team-bra", "team-eng"],
        topScorerName: "Lionel Messi",
        bestPlayerName: "Kylian Mbappe",
      },
      actuals
    );
    expect(result.champion).toBe(15);
    expect(result.runnerUp).toBe(10);
    expect(result.thirdPlace).toBe(5);
    expect(result.semifinalists).toBe(12); // 4 x 3
    expect(result.topScorer).toBe(10);
    expect(result.bestPlayer).toBe(10);
    expect(result.total).toBe(62);
  });

  it("awards 0 for completely wrong prediction", () => {
    const result = calculateBonusPoints(
      {
        championTeamId: "team-ger",
        runnerUpTeamId: "team-esp",
        thirdPlaceTeamId: "team-por",
        semifinalists: ["team-ger", "team-esp", "team-por", "team-ned"],
        topScorerName: "Harry Kane",
        bestPlayerName: "Vinicius Jr",
      },
      actuals
    );
    expect(result.total).toBe(0);
  });

  it("awards partial semifinalist points", () => {
    const result = calculateBonusPoints(
      {
        championTeamId: null,
        runnerUpTeamId: null,
        thirdPlaceTeamId: null,
        semifinalists: ["team-arg", "team-ger", "team-bra", "team-esp"],
        topScorerName: null,
        bestPlayerName: null,
      },
      actuals
    );
    expect(result.semifinalists).toBe(6); // 2 correct x 3
    expect(result.total).toBe(6);
  });

  it("handles accented name matching for top scorer", () => {
    const result = calculateBonusPoints(
      {
        championTeamId: null,
        runnerUpTeamId: null,
        thirdPlaceTeamId: null,
        semifinalists: null,
        topScorerName: "lionel messi", // lowercase, no accent
        bestPlayerName: "KYLIAN MBAPPE", // uppercase
      },
      actuals
    );
    expect(result.topScorer).toBe(10);
    expect(result.bestPlayer).toBe(10);
  });

  it("handles null predictions gracefully", () => {
    const result = calculateBonusPoints(
      {
        championTeamId: null,
        runnerUpTeamId: null,
        thirdPlaceTeamId: null,
        semifinalists: null,
        topScorerName: null,
        bestPlayerName: null,
      },
      actuals
    );
    expect(result.total).toBe(0);
  });
});

// ============================================================
// sortLeaderboard
// ============================================================

describe("sortLeaderboard", () => {
  it("sorts by total points descending", () => {
    const entries: LeaderboardEntry[] = [
      { userId: "a", displayName: "A", totalPoints: 10, exactCount: 1, resultCount: 2, wrongCount: 0, bonusPoints: 0, firstPredictionAt: null },
      { userId: "b", displayName: "B", totalPoints: 20, exactCount: 1, resultCount: 2, wrongCount: 0, bonusPoints: 0, firstPredictionAt: null },
    ];
    const sorted = sortLeaderboard(entries);
    expect(sorted[0].userId).toBe("b");
  });

  it("breaks tie by exact count", () => {
    const entries: LeaderboardEntry[] = [
      { userId: "a", displayName: "A", totalPoints: 20, exactCount: 2, resultCount: 4, wrongCount: 0, bonusPoints: 0, firstPredictionAt: null },
      { userId: "b", displayName: "B", totalPoints: 20, exactCount: 3, resultCount: 1, wrongCount: 0, bonusPoints: 0, firstPredictionAt: null },
    ];
    const sorted = sortLeaderboard(entries);
    expect(sorted[0].userId).toBe("b");
  });

  it("breaks second tie by result count", () => {
    const entries: LeaderboardEntry[] = [
      { userId: "a", displayName: "A", totalPoints: 20, exactCount: 3, resultCount: 2, wrongCount: 0, bonusPoints: 0, firstPredictionAt: null },
      { userId: "b", displayName: "B", totalPoints: 20, exactCount: 3, resultCount: 5, wrongCount: 0, bonusPoints: 0, firstPredictionAt: null },
    ];
    const sorted = sortLeaderboard(entries);
    expect(sorted[0].userId).toBe("b");
  });

  it("breaks third tie by earliest prediction", () => {
    const entries: LeaderboardEntry[] = [
      { userId: "a", displayName: "A", totalPoints: 20, exactCount: 3, resultCount: 5, wrongCount: 0, bonusPoints: 0, firstPredictionAt: new Date("2026-06-10T10:00:00Z") },
      { userId: "b", displayName: "B", totalPoints: 20, exactCount: 3, resultCount: 5, wrongCount: 0, bonusPoints: 0, firstPredictionAt: new Date("2026-06-09T10:00:00Z") },
    ];
    const sorted = sortLeaderboard(entries);
    expect(sorted[0].userId).toBe("b"); // earlier prediction wins
  });
});
