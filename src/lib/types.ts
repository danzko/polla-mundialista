export type Locale = 'es' | 'en';
export type MatchStage =
  | 'group' | 'league' | 'playoff' | 'r32' | 'r16' | 'qf' | 'sf' | 'third_place' | 'final';

/** One competition the club runs (World Cup 2026, Champions League 2026-27, ...). */
export interface Tournament {
  id: string;
  slug: string;              // 'wc-2026', 'ucl-2026-27'
  kind: 'world_cup' | 'ucl';
  nameEn: string;
  nameEs: string;
  status: 'upcoming' | 'active' | 'archived';
  startsAt: string | null;
  endsAt: string | null;
  picksLockAt: string | null;     // champion / boot / ball picks lock
  bracketDeadline: string | null; // one-shot bracket entry deadline (null = per-match kickoff lock only)
}

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
  flagEmoji: string;             // '' for clubs (they use logoUrl)
  logoUrl: string | null;        // club crest (ESPN CDN); null for national teams
  group: string | null;          // 'A'..'L'; null for a league phase
  groupPosition: number | null;  // 1..4; null for a league phase
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
  matchday: number | null;    // league-phase round (1..8), null otherwise
  leg: number | null;         // 1 / 2 for two-legged ties, null for single games
  tieNumber: number | null;   // groups the two legs of one tie
  kickoffAt: string;          // ISO 8601 UTC
  homeTeam: Team | null;      // null for TBD knockout slots
  awayTeam: Team | null;
  isVoided: boolean;
  locked: boolean;                  // true once kickoff has passed or voided
  isBanker: boolean;                // La Fija: this game's points count double for the viewer
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
  fullyUnlocked: boolean;    // per-user admin grace: edit ANY knockout game (even started) until it expires
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
  // pre-tournament picks (locked June 11), so a peer's bracket view can show them too
  championTeamId: string | null;
  bootPick: string | null;   // Golden Boot pick (player name)
  ballPick: string | null;   // Golden Ball pick (player name)
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
  exactCount: number;     // # of exact-scoreline hits (6-pointers), group + KO
  resultCount: number;    // # of correct-outcome-wrong-score hits (2-pointers), group + KO
  wrongCount: number;     // # of missed scorelines (0-pointers), group + KO
  bracketCorrect: number; // # of bracket advancement picks currently paying off
  bracketAlive: number;   // # of bracket picks still able to score (team not yet out)
  // season mechanics
  bankerPoints: number;   // extra points earned by La Fija (the doubled half)
  jornadaWins: number;    // matchdays won (+5 each, already in total)
  top8Points: number;     // Top 8 call points (already in total)
  exactStreak: number;    // consecutive exact scores, most recent first
  duelRecord: { wins: number; losses: number; draws: number };
  // rank change since the start of the most recent result day (+ = climbed,
  // - = dropped, 0 = held, null = no prior snapshot to compare)
  movement: number | null;
  // their predicted champion (for the flag next to the name)
  championTeamId: string | null;
  championCode: string | null;
  championNameEs: string | null;
  championNameEn: string | null;
  championFlagEmoji: string | null;
  championLogoUrl: string | null;
  championEliminated: boolean;
}

// ---- Season hub (dashboard) + Hall of Fame ----
/** The upcoming (or in-progress) round of the current tournament. */
export interface NextMatchday {
  matchday: number | null;    // league-phase round; null for a knockout round
  label: string;              // 'Jornada 3' / 'Octavos', already localized
  firstKickoff: string;       // ISO
  lastKickoff: string;        // ISO
  total: number;              // games in the round with both teams known
  saved: number;              // of those, games the viewer has predicted
  open: number;               // of those, games still open for picks
  liveCount: number;
  fixtures: NextFixture[];    // the round's games in kickoff order (for the slip)
  bankerMatchId: string | null; // the viewer's La Fija for this round
  duel: Duel | null;          // this round's head-to-head (first league)
}
/** One matchday's head-to-head pairing for the viewer. */
export interface Duel {
  matchday: number;
  opponentId: string;
  opponentName: string;
  myPoints: number;
  theirPoints: number;
  status: 'pending' | 'win' | 'loss' | 'draw';
}
/** Weekly board for one league + matchday. */
export interface MatchdayBoard {
  leagueId: string;
  leagueName: string;
  matchday: number;
  matchdays: number[];        // rounds with any played game, for the selector
  complete: boolean;          // every game of the round has a result
  entries: {
    rank: number; userId: string; displayName: string; points: number; isMe: boolean;
    isWinner: boolean;        // top of a COMPLETE matchday (+5)
    opponentId: string | null; opponentName: string | null;
    duel: 'pending' | 'win' | 'loss' | 'draw' | 'bye';
  }[];
}
export interface NextFixture {
  id: string;
  kickoffAt: string;
  home: { code: string; nameEs: string; nameEn: string; flagEmoji: string; logoUrl: string | null };
  away: { code: string; nameEs: string; nameEn: string; flagEmoji: string; logoUrl: string | null };
  myPick: { h: number; a: number } | null;
  locked: boolean;
}
/** One archived tournament's final standing within the viewer's league. */
export interface HonorsEntry {
  tournament: Tournament;
  leagueName: string | null;
  participants: number;
  podium: { userId: string; displayName: string; points: number; isMe: boolean }[];
  myRank: number | null;
  myPoints: number;
  // the real champion of that tournament (for the plaque)
  championName: string | null;
  championCode: string | null;
  championFlagEmoji: string | null;
  championLogoUrl: string | null;
  // full final table (Hall of Fame page only)
  standings?: { rank: number; userId: string; displayName: string; points: number; isMe: boolean }[];
}
export interface SeasonHub {
  tournament: Tournament;
  nextMatchday: NextMatchday | null;
  honors: HonorsEntry[];
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
  logoUrl: string | null;
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
  // top 3 + the viewer (if outside the top 3), for the mini-table
  top: { userId: string; displayName: string; points: number; rank: number; isMe: boolean }[];
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
  top8TeamIds: string[];          // Top 8 call (league phase), up to 8 team ids
  locked: boolean;
  lockAt: string;                 // ISO 8601 UTC
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
