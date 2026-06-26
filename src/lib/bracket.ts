/**
 * 2026 World Cup knockout bracket tree (FIFA regulations, validated in
 * scripts/wc2026-bracket-structure.json). Matches 73–104. Each match's
 * two sides are either a group slot (R32, e.g. "2A", "3:A/B/C/D/F") or a
 * feed from an earlier knockout match ("W74" = winner of 74, "L101" =
 * loser of 101). The feed graph is THE advancement logic — we never
 * invent it; real teams come from results, predicted teams from the
 * player's own bracket picks.
 */

export type KnockoutRound = 'r32' | 'r16' | 'qf' | 'sf' | 'third_place' | 'final';

export interface BracketNode {
  match: number;        // FIFA match number 73–104
  round: KnockoutRound;
  /** Source of the home/away participant: a group slot or a feed ref. */
  home: string;
  away: string;
}

const R32: Array<{ match: number; home: string; away: string }> = [
  { match: 73, home: '2A', away: '2B' },
  { match: 74, home: '1E', away: '3:A/B/C/D/F' },
  { match: 75, home: '1F', away: '2C' },
  { match: 76, home: '1C', away: '2F' },
  { match: 77, home: '1I', away: '3:C/D/F/G/H' },
  { match: 78, home: '2E', away: '2I' },
  { match: 79, home: '1A', away: '3:C/E/F/H/I' },
  { match: 80, home: '1L', away: '3:E/H/I/J/K' },
  { match: 81, home: '1D', away: '3:B/E/F/I/J' },
  { match: 82, home: '1G', away: '3:A/E/H/I/J' },
  { match: 83, home: '2K', away: '2L' },
  { match: 84, home: '1H', away: '2J' },
  { match: 85, home: '1B', away: '3:E/F/G/I/J' },
  { match: 86, home: '1J', away: '2H' },
  { match: 87, home: '1K', away: '3:D/E/I/J/L' },
  { match: 88, home: '2D', away: '2G' },
];

const LATER: Array<{ match: number; home: string; away: string }> = [
  { match: 89, home: 'W74', away: 'W77' },
  { match: 90, home: 'W73', away: 'W75' },
  { match: 91, home: 'W76', away: 'W78' },
  { match: 92, home: 'W79', away: 'W80' },
  { match: 93, home: 'W83', away: 'W84' },
  { match: 94, home: 'W81', away: 'W82' },
  { match: 95, home: 'W86', away: 'W88' },
  { match: 96, home: 'W85', away: 'W87' },
  { match: 97, home: 'W89', away: 'W90' },
  { match: 98, home: 'W93', away: 'W94' },
  { match: 99, home: 'W91', away: 'W92' },
  { match: 100, home: 'W95', away: 'W96' },
  { match: 101, home: 'W97', away: 'W98' },
  { match: 102, home: 'W99', away: 'W100' },
  { match: 103, home: 'L101', away: 'L102' }, // third-place game
  { match: 104, home: 'W101', away: 'W102' }, // final
];

export function roundOf(match: number): KnockoutRound {
  if (match >= 73 && match <= 88) return 'r32';
  if (match >= 89 && match <= 96) return 'r16';
  if (match >= 97 && match <= 100) return 'qf';
  if (match === 103) return 'third_place';
  if (match === 104) return 'final';
  return 'sf'; // 101, 102
}

export const BRACKET: BracketNode[] = [...R32, ...LATER].map((n) => ({
  ...n,
  round: roundOf(n.match),
}));

export const BRACKET_BY_MATCH: Record<number, BracketNode> = Object.fromEntries(
  BRACKET.map((n) => [n.match, n])
);

/** Ordered rounds with their match numbers, for round-by-round UI. */
export const ROUND_ORDER: Array<{ round: KnockoutRound; matches: number[] }> = [
  { round: 'r32', matches: R32.map((m) => m.match) },
  { round: 'r16', matches: [89, 90, 91, 92, 93, 94, 95, 96] },
  { round: 'qf', matches: [97, 98, 99, 100] },
  { round: 'sf', matches: [101, 102] },
  { round: 'final', matches: [104] },
  { round: 'third_place', matches: [103] },
];

/** Parse a feed ref like "W74" / "L101" → { kind, match }, else null. */
export function parseFeed(ref: string): { kind: 'W' | 'L'; match: number } | null {
  const m = /^([WL])(\d+)$/.exec(ref);
  return m ? { kind: m[1] as 'W' | 'L', match: parseInt(m[2], 10) } : null;
}

/**
 * Given a map of match → advancer (winner) team id and match → loser team
 * id, resolve who sits in a given side ref. For R32 group slots, the
 * caller supplies real team ids via `groupSlot`. Returns a team id or null
 * if not yet determined.
 */
export function resolveSide(
  ref: string,
  winners: Record<number, string | null>,
  losers: Record<number, string | null>,
  groupSlot: (slot: string) => string | null
): string | null {
  const feed = parseFeed(ref);
  if (!feed) return groupSlot(ref);
  return feed.kind === 'W' ? winners[feed.match] ?? null : losers[feed.match] ?? null;
}

export const KO_FIRST_MATCH = 73;
export const KO_LAST_MATCH = 104;
