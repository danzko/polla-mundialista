export type Locale = 'es' | 'en';
export type MatchStage =
  | 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third_place' | 'final';

export interface SessionUser {
  id: string;
  displayName: string;
  preferredLanguage: Locale;
  isSuperadmin: boolean;
  onboarded: boolean;
  nameChangeUsed: boolean; // true once the one-time rename has been used
}

export interface Team {
  id: string;
  code: string;          // FIFA 3-letter, e.g. "MEX"
  nameEn: string;
  nameEs: string;
  flagEmoji: string;
  group: string;         // 'A'..'L'
  groupPosition: number; // 1..4
  eliminated: boolean;
}

export interface ScorePrediction {
  homeScore: number;     // 0..15
  awayScore: number;     // 0..15
}

export interface MatchView {
  id: string;
  matchNumber: number;        // 1..104
  stage: MatchStage;
  groupLabel: string | null;  // 'A'..'L' for group, null for knockouts
  kickoffAt: string;          // ISO 8601 UTC
  homeTeam: Team | null;      // null for TBD knockout slots
  awayTeam: Team | null;
  isVoided: boolean;
  locked: boolean;                  // true once kickoff has passed or voided
  myPrediction: ScorePrediction | null;
  result: ScorePrediction | null;   // null until a result is recorded
  pointsEarned: number | null;      // null until scored
}

/**
 * One contestant's pick for a started/past match, shown in the per-card
 * picks strip. points/outcome are null+'pending' until a final result
 * exists (owner choice: neutral until final).
 */
export interface MatchPickRow {
  userId: string;
  displayName: string;
  homeScore: number | null; // null = this league-mate didn't enter a pick
  awayScore: number | null;
  points: number | null;
  outcome: 'exact' | 'result' | 'wrong' | 'pending';
}

/** Real-time score for one match, mirrored from the live_scores table. */
export interface LiveScore {
  status: 'pre' | 'in' | 'post';
  homeScore: number | null;
  awayScore: number | null;
  displayClock: string | null;
  completed: boolean;
}

export interface LiveScoresPayload {
  scores: Record<string, LiveScore>;
  lastRunAt: string | null; // heartbeat: when the ESPN sync last ran
}

/** One knockout match in the bracket view: its real participants (once
 * assigned) plus the viewer's own pick for it. */
export interface BracketMatchView {
  matchId: string;
  matchNumber: number;       // 73–104
  stage: MatchStage;
  kickoffAt: string;
  homeTeamId: string | null; // real team once groups conclude / round resolves
  awayTeamId: string | null;
  myAdvancerTeamId: string | null;
  myHomeScore: number | null;
  myAwayScore: number | null;
}

export interface BracketView {
  lockAt: string | null;     // first R32 kickoff
  locked: boolean;
  matches: BracketMatchView[];
}

// One league-mate's bracket, for the post-deadline comparison view.
export interface BracketPeer {
  userId: string;
  displayName: string;
  isMe: boolean;
  advancers: Record<number, string | null>; // matchNumber -> advancer teamId
  points: number;        // advancement points earned so far (live scoring)
  correctPicks: number;  // picks already paying off
  alivePicks: number;    // picks still able to score (team not yet eliminated)
}

export interface BracketComparison {
  available: boolean;                          // false until the deadline passes
  actualAdvancers: Record<number, string>;     // matchNumber -> real advancer teamId
  eliminatedTeamIds: string[];                 // teams knocked out so far
  peers: BracketPeer[];                        // league-mates (incl. you), ranked
}

// Unified leaderboard: one ranked row per player with the full point breakdown.
export interface UnifiedLeaderboardEntry {
  userId: string;
  displayName: string;
  isMe: boolean;
  rank: number;
  total: number;
  // the four point sources that sum to `total`
  groupScore: number;     // group-stage scorelines (6/2/0)
  koScore: number;        // knockout scorelines (6/2/0)
  bracket: number;        // bracket advancement (4/8/16/30/55)
  bonus: number;          // pre-tournament picks (champion 50 + boot 25 + ball 25)
  koTiebreak: number;     // knockout-stage points (the tiebreaker)
  // rank change since the start of the most recent result day (+ = climbed,
  // - = dropped, 0 = held, null = no prior snapshot to compare)
  movement: number | null;
  // their predicted champion (for the flag next to the name)
  championTeamId: string | null;
  championCode: string | null;
  championNameEs: string | null;
  championNameEn: string | null;
  championFlagEmoji: string | null;
  championEliminated: boolean;
}

export interface LeaderboardData {
  myUserId: string | null;
  leagues: { id: string; name: string }[];  // the viewer's live leagues (for the filter)
  leagueId: string | null;                   // the league being shown
  leagueName: string | null;
  entries: UnifiedLeaderboardEntry[];
}

// ---- Statistics tab ----
// One row of the "Title Race": Vegas odds (snapshot) + this league's champion-pick consensus.
export interface TitleRaceRow {
  teamCode: string;
  teamName: string;
  flagEmoji: string | null;
  eliminated: boolean;
  vegasOdds: string | null;        // e.g. "+280" (null until the snapshot is set)
  vegasImpliedPct: number | null;  // e.g. 26
  leagueCount: number;             // how many in the league picked them as champion
  leaguePct: number;               // % of the league
  pickedBy: string[];              // display names
}
// One row of the Golden Boot race: live scorer (snapshot) merged with league pick consensus.
export interface BootRaceRow {
  rank: number | null;             // snapshot leaderboard rank (null = a league pick not on the board)
  playerName: string;
  teamCode: string | null;
  flagEmoji: string | null;
  goals: number | null;            // current goals (null until snapshot set)
  photoUrl: string | null;
  leagueCount: number;
  leaguePct: number;
  pickedBy: string[];
}
// Generic pick-share row (Golden Ball, etc.)
export interface PickShare {
  label: string;
  count: number;
  pct: number;
  pickedBy: string[];
}
export interface StatsData {
  leagues: { id: string; name: string }[];
  leagueId: string | null;
  leagueName: string | null;
  memberCount: number;
  titleRace: TitleRaceRow[];
  goldenBoot: BootRaceRow[];
  goldenBall: PickShare[];
  snapshotLoaded: boolean;         // whether the live scorers/odds overlay is populated
}

export interface LeagueSummary {
  id: string;
  name: string;
  inviteCode: string;   // 6-char alphanumeric, uppercase
  language: Locale;
  memberCount: number;
  myRank: number | null;
  myPoints: number;
  isAdmin: boolean;
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  displayName: string;
  totalPoints: number;
  matchPoints: number;
  bonusPoints: number;
  exactCount: number;
  resultCount: number;
  isMe: boolean;
}

export interface LeagueMemberView {
  userId: string;
  displayName: string;
  isAdmin: boolean;
}

export interface LeagueDetail {
  id: string;
  name: string;
  inviteCode: string;
  language: Locale;
  isAdmin: boolean;
  members: LeagueMemberView[];
  leaderboard: LeaderboardRow[];
}

export interface BonusView {
  championTeamId: string | null;
  runnerUpTeamId: string | null;
  thirdPlaceTeamId: string | null;
  semifinalists: string[];        // up to 4 team ids
  topScorerNames: string[];       // up to 3, ranked: gold, silver, bronze boot
  bestPlayerNames: string[];      // up to 3, ranked: gold, silver, bronze ball
  locked: boolean;
  lockAt: string;                 // ISO 8601 UTC, '2026-06-11T19:00:00Z'
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
