export type Locale = 'es' | 'en';
export type MatchStage =
  | 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third_place' | 'final';

export interface SessionUser {
  id: string;
  displayName: string;
  preferredLanguage: Locale;
  isSuperadmin: boolean;
  onboarded: boolean;
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
  topScorerName: string | null;
  bestPlayerName: string | null;
  locked: boolean;
  lockAt: string;                 // ISO 8601 UTC, '2026-06-11T19:00:00Z'
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
