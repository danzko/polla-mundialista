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

// Knockout BRACKET entry deadline (owner decision June 28): the advancer
// bracket stays open until end of day so people have time — EXCEPT any game
// that kicks off before then. So a pick for match M locks at
//   min(BRACKET_ENTRY_DEADLINE, kickoff(M) - 15 min).
// Match 73 (3:00pm ET today) therefore locks at 2:45pm ET; everything else
// (R32 games Jun 29+, and R16→Final) locks at this deadline tonight.
// 11:59 PM ET, Jun 28 2026 == 03:59 UTC Jun 29. Mirrored in RLS (0017).
export const BRACKET_ENTRY_DEADLINE_ISO = "2026-06-29T03:59:00Z";
