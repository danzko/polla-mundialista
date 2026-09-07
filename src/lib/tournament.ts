// Tournament constants. Per-tournament dates (picks lock, bracket deadline)
// live in the `tournaments` table (migration 0031) and are read at runtime
// via getCurrentTournament() in api.ts — nothing here is World-Cup-specific.

// Fixed ids (set by migration 0031) so code can reference tournaments directly.
export const WC_2026_ID = "a0000000-0000-4000-8000-000000002026";
export const UCL_2026_27_ID = "a0000000-0000-4000-8000-000000002627";

// Cookie holding the slug of the tournament the viewer is looking at.
export const TOURNAMENT_COOKIE = "t";

// Score predictions lock PER MATCH, this long before each match's kickoff
// (community vote June 12, 2026). A match whose lock moment passed never
// reopens. Mirrored in the predictions RLS policies (migration 0010).
export const LOCK_BEFORE_KICKOFF_MS = 15 * 60_000;

// Stages whose scoreline is the "regular season" (no bracket involvement).
export const LEAGUE_STAGES = ["group", "league"] as const;

// Postgres returns 'infinity' for a tournament without a one-shot bracket
// deadline (per-match kickoff locks only). Normalise to null.
export function finiteIso(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const ms = new Date(v).getTime();
  return Number.isFinite(ms) ? v : null;
}
