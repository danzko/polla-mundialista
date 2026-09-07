/**
 * Duelos: each matchday every league member is paired with one league-mate;
 * most matchday points wins the duel. Pairings are DERIVED, not stored: a
 * deterministic shuffle seeded by (league, matchday) — same result for
 * everyone, every time, no table. An odd member count leaves one bye.
 */

// FNV-1a 32-bit: tiny, deterministic, good enough to shuffle a friend group.
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** userId -> opponentId (null = bye). Symmetric. */
export function pairMembers(leagueId: string, matchday: number, memberIds: string[]): Map<string, string | null> {
  const order = [...new Set(memberIds)].sort(
    (a, b) => fnv1a(`${leagueId}:${matchday}:${a}`) - fnv1a(`${leagueId}:${matchday}:${b}`) || a.localeCompare(b)
  );
  const out = new Map<string, string | null>();
  for (let i = 0; i + 1 < order.length; i += 2) {
    out.set(order[i], order[i + 1]);
    out.set(order[i + 1], order[i]);
  }
  if (order.length % 2 === 1) out.set(order[order.length - 1], null);
  return out;
}

export function duelOutcome(mine: number, theirs: number, complete: boolean): 'pending' | 'win' | 'loss' | 'draw' {
  if (!complete) return 'pending';
  return mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw';
}
