import { describe, it, expect } from "vitest";
import {
  scoreEntry,
  scoreBracket,
  BRACKET_SCORING,
  type Entry,
  type ActualResults,
  type EnrichedPick,
  type RealMatchResult,
} from "../src/lib/bracket-scoring";

// ---------------------------------------------------------------------------
// Spec §7 test vectors — verbatim from docs/wc2026_pool_scoring_spec.md (v1.1).
// Each builds a minimal entry/actual and asserts the point delta.
// ---------------------------------------------------------------------------

const emptyAdv = { R16: [], QF: [], SF: [], FINAL: [], CHAMPION: "" };
const blankEntryBracket = { R16: [], QF: [], SF: [], FINAL: [], CHAMPION: "" };

function actual(over: Partial<ActualResults>): ActualResults {
  return { advancers: { ...emptyAdv }, matches: [], ...over };
}
function entry(over: Partial<Entry>): Entry {
  return { bracket: { ...blankEntryBracket }, match_predictions: [], ...over };
}

describe("spec v1.1 test vectors", () => {
  it("T1 — bracket champion", () => {
    const e = entry({ bracket: { ...blankEntryBracket, CHAMPION: "FRA" } });
    expect(scoreEntry(e, actual({ advancers: { ...emptyAdv, CHAMPION: "FRA" } })).total).toBe(55);
    expect(scoreEntry(e, actual({ advancers: { ...emptyAdv, CHAMPION: "ESP" } })).total).toBe(0);
  });

  it("T2 — bracket finalists (partial)", () => {
    const e = entry({ bracket: { ...blankEntryBracket, FINAL: ["FRA", "BRA"] } });
    const a = actual({ advancers: { ...emptyAdv, FINAL: ["FRA", "ESP"] } });
    expect(scoreEntry(e, a).total).toBe(30);
  });

  it("T3 — bracket R16 set intersection", () => {
    const predicted = Array.from({ length: 16 }, (_, i) => `P${i}`);
    const reached = [...predicted.slice(0, 12), "X1", "X2", "X3", "X4"];
    const e = entry({ bracket: { ...blankEntryBracket, R16: predicted } });
    const a = actual({ advancers: { ...emptyAdv, R16: reached } });
    expect(scoreEntry(e, a).total).toBe(48); // 12 × 4
  });

  it("T4 — result bonus, R16, win on penalties", () => {
    const e = entry({ match_predictions: [{ match_id: "R16-1", pred_winner: "BRA" }] });
    const a = actual({ matches: [{ id: "R16-1", round: "R16", goals: { BRA: 1, ARG: 1 }, winner: "BRA" }] });
    expect(scoreEntry(e, a).total).toBe(3);
  });

  it("T5 — result bonus excluded in R32", () => {
    const e = entry({ match_predictions: [{ match_id: "R32-1", pred_winner: "BRA" }] });
    const a = actual({ matches: [{ id: "R32-1", round: "R32", goals: { BRA: 1, ARG: 0 }, winner: "BRA" }] });
    expect(scoreEntry(e, a).total).toBe(0);
  });

  it("T6 — exact score R32", () => {
    const e = entry({ match_predictions: [{ match_id: "R32-1", pred_goals: { BRA: 2, ARG: 1 } }] });
    const a = actual({ matches: [{ id: "R32-1", round: "R32", goals: { BRA: 2, ARG: 1 }, winner: "BRA" }] });
    expect(scoreEntry(e, a).total).toBe(2);
  });

  it("T7 — exact score R16+", () => {
    const e = entry({ match_predictions: [{ match_id: "QF-1", pred_goals: { ESP: 0, GER: 0 } }] });
    const a = actual({ matches: [{ id: "QF-1", round: "QF", goals: { ESP: 0, GER: 0 }, winner: "ESP" }] });
    expect(scoreEntry(e, a).total).toBe(1);
  });

  it("T8 — exact score, ET line vs shootout (+ result)", () => {
    const e = entry({ match_predictions: [{ match_id: "SF-1", pred_winner: "FRA", pred_goals: { FRA: 1, POR: 1 } }] });
    const a = actual({ matches: [{ id: "SF-1", round: "SF", goals: { FRA: 1, POR: 1 }, winner: "FRA" }] });
    expect(scoreEntry(e, a).total).toBe(4); // 3 result + 1 exact
  });

  it("T9 — exact score reversed orientation", () => {
    const e = entry({ match_predictions: [{ match_id: "R32-1", pred_goals: { BRA: 2, ARG: 1 } }] });
    const a = actual({ matches: [{ id: "R32-1", round: "R32", goals: { BRA: 1, ARG: 2 }, winner: "ARG" }] });
    expect(scoreEntry(e, a).total).toBe(0);
  });

  it("T10 — combined R16 exact + result", () => {
    const e = entry({ match_predictions: [{ match_id: "R16-1", pred_winner: "BRA", pred_goals: { BRA: 2, ARG: 1 } }] });
    const a = actual({ matches: [{ id: "R16-1", round: "R16", goals: { BRA: 2, ARG: 1 }, winner: "BRA" }] });
    expect(scoreEntry(e, a).total).toBe(4);
  });

  it("T11 — combined, result only (wrong scoreline)", () => {
    const e = entry({ match_predictions: [{ match_id: "R16-1", pred_winner: "BRA", pred_goals: { BRA: 2, ARG: 1 } }] });
    const a = actual({ matches: [{ id: "R16-1", round: "R16", goals: { BRA: 3, ARG: 1 }, winner: "BRA" }] });
    expect(scoreEntry(e, a).total).toBe(3);
  });

  it("T12 — third-place match, full credit", () => {
    const e = entry({ match_predictions: [{ match_id: "THIRD-1", pred_winner: "GER", pred_goals: { GER: 2, NED: 0 } }] });
    const a = actual({ matches: [{ id: "THIRD-1", round: "THIRD", goals: { GER: 2, NED: 0 }, winner: "GER" }] });
    expect(scoreEntry(e, a).total).toBe(4); // 3 result + 1 exact
  });

  it("T13 — third-place adds no bracket advancement (default off)", () => {
    const e = entry({ bracket: { ...blankEntryBracket, THIRD: "GER" } });
    const a = actual({ advancers: { ...emptyAdv, THIRD: "GER" } });
    expect(scoreEntry(e, a).total).toBe(0);
  });

  it("invariant — a perfect entry scores exactly 403", () => {
    const r16Teams = Array.from({ length: 16 }, (_, i) => `T${i}`);
    const qfTeams = r16Teams.slice(0, 8);
    const sfTeams = r16Teams.slice(0, 4);
    const finalTeams = r16Teams.slice(0, 2);
    const champion = r16Teams[0];

    const rounds: Array<{ round: ActualResults["matches"][number]["round"]; count: number }> = [
      { round: "R32", count: 16 },
      { round: "R16", count: 8 },
      { round: "QF", count: 4 },
      { round: "SF", count: 2 },
      { round: "FINAL", count: 1 },
      { round: "THIRD", count: 1 },
    ];
    const matches: ActualResults["matches"] = [];
    let n = 0;
    for (const { round, count } of rounds) {
      for (let i = 0; i < count; i++) {
        const id = `M${n++}`;
        matches.push({ id, round, goals: { H: 2, A: 1 }, winner: "H" });
      }
    }
    const a: ActualResults = {
      advancers: { R16: r16Teams, QF: qfTeams, SF: sfTeams, FINAL: finalTeams, CHAMPION: champion },
      matches,
    };
    const e: Entry = {
      bracket: { R16: r16Teams, QF: qfTeams, SF: sfTeams, FINAL: finalTeams, CHAMPION: champion },
      match_predictions: matches.map((m) => ({ match_id: m.id, pred_winner: m.winner, pred_goals: m.goals })),
    };
    const s = scoreEntry(e, a);
    expect(s.advancement).toBe(307 - 55); // 16*4+8*8+4*16+2*30 = 252
    expect(s.champion).toBe(55);
    expect(s.result).toBe(48); // 16 eligible matches × 3 (R16,QF,SF,FINAL,THIRD)
    expect(s.exact).toBe(48); // R32 16×2 + 16×1
    expect(s.total).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Per-match adapter (the app's storage shape).
// ---------------------------------------------------------------------------

const pick = (match: number, adv: string, h?: number, a?: number, ph?: string, pa?: string): EnrichedPick => ({
  match, advancerTeamId: adv, homeScore: h ?? null, awayScore: a ?? null,
  predictedHomeTeamId: ph ?? null, predictedAwayTeamId: pa ?? null,
});
const real = (match: number, w: string, h?: number, a?: number, ht?: string, at?: string): RealMatchResult => ({
  match, winnerTeamId: w, homeScore: h ?? null, awayScore: a ?? null,
  homeTeamId: ht ?? null, awayTeamId: at ?? null,
});

describe("scoreBracket adapter", () => {
  it("advancement only for teams that actually reached the round", () => {
    const s = scoreBracket([pick(73, "A"), pick(74, "B")], [real(73, "A"), real(74, "X")]);
    expect(s.correct.r16).toBe(1);
    expect(s.r16).toBe(BRACKET_SCORING.advancement.r16);
  });

  it("champion (winner of 104) pays 55, once", () => {
    expect(scoreBracket([pick(104, "A")], [real(104, "A")]).champion).toBe(55);
    expect(scoreBracket([pick(104, "B")], [real(104, "A")]).champion).toBe(0);
  });

  it("result bonus is excluded in R32 but paid in R16+", () => {
    expect(scoreBracket([pick(73, "A")], [real(73, "A")]).result).toBe(0); // R32
    expect(scoreBracket([pick(89, "A")], [real(89, "A")]).result).toBe(3); // R16
  });

  it("exact score: R32=2, later rounds=1, orientation-safe", () => {
    expect(scoreBracket([pick(73, "A", 2, 1, "A", "B")], [real(73, "A", 2, 1, "A", "B")]).exactScore).toBe(2);
    expect(scoreBracket([pick(89, "A", 2, 1, "A", "B")], [real(89, "A", 2, 1, "A", "B")]).exactScore).toBe(1);
    // reversed orientation → no exact
    expect(scoreBracket([pick(73, "A", 2, 1, "A", "B")], [real(73, "B", 1, 2, "A", "B")]).exactScore).toBe(0);
  });

  it("third-place match (103) pays result+exact, never advancement", () => {
    const s = scoreBracket([pick(103, "A", 2, 0, "A", "B")], [real(103, "A", 2, 0, "A", "B")]);
    expect(s.result).toBe(3);
    expect(s.exactScore).toBe(1);
    expect(s.r16 + s.qf + s.sf + s.final).toBe(0);
  });

  it("respects tunable weights", () => {
    const cfg = { ...BRACKET_SCORING, advancement: { ...BRACKET_SCORING.advancement, r16: 99 } };
    expect(scoreBracket([pick(73, "A")], [real(73, "A")], cfg).r16).toBe(99);
  });
});
