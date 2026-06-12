// First kickoff of the tournament (Mexico vs South Africa).
// The three tournament picks (champion / top scorer / best player)
// locked at this moment and stay locked.
export const TOURNAMENT_START_ISO = "2026-06-11T19:00:00Z";

// Group-stage score predictions lock PER MATCH, this long before each
// match's kickoff (community vote June 12, 2026 — supersedes the
// lock-everything-at-tournament-start rule). A match whose lock moment
// passed never reopens. Mirrored in the predictions RLS policies
// (migration 0010_per_match_lock_15min).
export const LOCK_BEFORE_KICKOFF_MS = 15 * 60_000;
