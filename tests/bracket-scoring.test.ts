import { describe, it, expect } from "vitest";
import { scoreBracket, BRACKET_SCORING, type EnrichedPick, type RealMatchResult } from "../src/lib/bracket-scoring";

// Helper to build a pick / result quickly.
const pick = (match: number, adv: string, h?: number, a?: number, ph?: string, pa?: string): EnrichedPick => ({
  match, advancerTeamId: adv, homeScore: h ?? null, awayScore: a ?? null,
  predictedHomeTeamId: ph ?? null, predictedAwayTeamId: pa ?? null,
});
const real = (match: number, w: string, h?: number, a?: number, ht?: string, at?: string): RealMatchResult => ({
  match, winnerTeamId: w, homeScore: h ?? null, awayScore: a ?? null,
  homeTeamId: ht ?? null, awayTeamId: at ?? null,
});

describe("scoreBracket", () => {
  it("awards per-round advancement only for teams that actually reached the round", () => {
    // Player advances A and B out of two R32 games; reality: A advanced, X advanced.
    const picks = [pick(73, "A"), pick(74, "B")];
    const results = [real(73, "A"), real(74, "X")];
    const s = scoreBracket(picks, results);
    expect(s.correct.r16).toBe(1); // only A
    expect(s.r16).toBe(BRACKET_SCORING.advancement.r16);
  });

  it("scales by round: a correct finalist is worth far more than a correct R16 team", () => {
    const r16 = scoreBracket([pick(73, "A")], [real(73, "A")]).r16;
    const fin = scoreBracket([pick(101, "A")], [real(101, "A")]).final;
    expect(fin).toBeGreaterThan(r16 * 3);
  });

  it("scores the third-place finisher (match 103)", () => {
    expect(scoreBracket([pick(103, "A")], [real(103, "A")]).thirdPlace).toBe(BRACKET_SCORING.thirdPlace);
    expect(scoreBracket([pick(103, "B")], [real(103, "A")]).thirdPlace).toBe(0);
  });

  it("gives the exact-score bonus only when matchup, winner and score all match", () => {
    // Correct matchup + winner + exact score.
    const good = scoreBracket(
      [pick(73, "A", 2, 1, "A", "B")],
      [real(73, "A", 2, 1, "A", "B")]
    );
    expect(good.exactScore).toBe(BRACKET_SCORING.exactScore);
    // Right winner, wrong score → no bonus.
    const wrongScore = scoreBracket(
      [pick(73, "A", 3, 0, "A", "B")],
      [real(73, "A", 2, 1, "A", "B")]
    );
    expect(wrongScore.exactScore).toBe(0);
  });

  it("respects tunable weights", () => {
    const cfg = { ...BRACKET_SCORING, advancement: { ...BRACKET_SCORING.advancement, r16: 99 } };
    expect(scoreBracket([pick(73, "A")], [real(73, "A")], cfg).r16).toBe(99);
  });
});
