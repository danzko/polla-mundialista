import type { SessionUser, Team, MatchView, LeagueSummary, LeagueDetail, BonusView } from './types';

// 1. Session User (Change onboarded to false to test the onboarding screen)
export let currentUser: SessionUser | null = {
  id: 'user-me',
  displayName: 'Danny',
  preferredLanguage: 'es',
  isSuperadmin: true,
  onboarded: true,
};

export function setCurrentUser(user: SessionUser | null) {
  currentUser = user;
}

// Helper to check if predictions/bonuses are locked
// For testing, we set the cutoff dates.
export const tournamentStartStr = '2026-06-11T19:00:00Z';

// 2. Teams Fixtures (16 teams representing various groups)
export const mockTeams: Team[] = [
  { id: 't-1', code: 'MEX', nameEn: 'Mexico', nameEs: 'México', flagEmoji: '🇲🇽', group: 'A', groupPosition: 1, eliminated: false },
  { id: 't-2', code: 'RSA', nameEn: 'South Africa', nameEs: 'Sudáfrica', flagEmoji: '🇿🇦', group: 'A', groupPosition: 2, eliminated: false },
  { id: 't-3', code: 'KOR', nameEn: 'South Korea', nameEs: 'Corea del Sur', flagEmoji: '🇰🇷', group: 'A', groupPosition: 3, eliminated: false },
  { id: 't-4', code: 'CZE', nameEn: 'Czech Republic', nameEs: 'República Checa', flagEmoji: '🇨🇿', group: 'A', groupPosition: 4, eliminated: false },
  { id: 't-5', code: 'CAN', nameEn: 'Canada', nameEs: 'Canadá', flagEmoji: '🇨🇦', group: 'B', groupPosition: 1, eliminated: false },
  { id: 't-8', code: 'SUI', nameEn: 'Switzerland', nameEs: 'Suiza', flagEmoji: '🇨🇭', group: 'B', groupPosition: 4, eliminated: false },
  { id: 't-9', code: 'BRA', nameEn: 'Brazil', nameEs: 'Brasil', flagEmoji: '🇧🇷', group: 'C', groupPosition: 1, eliminated: false },
  { id: 't-10', code: 'MAR', nameEn: 'Morocco', nameEs: 'Marruecos', flagEmoji: '🇲🇦', group: 'C', groupPosition: 2, eliminated: false },
  { id: 't-13', code: 'USA', nameEn: 'United States', nameEs: 'Estados Unidos', flagEmoji: '🇺🇸', group: 'D', groupPosition: 1, eliminated: false },
  { id: 't-17', code: 'GER', nameEn: 'Germany', nameEs: 'Alemania', flagEmoji: '🇩🇪', group: 'E', groupPosition: 1, eliminated: false },
  { id: 't-21', code: 'NED', nameEn: 'Netherlands', nameEs: 'Países Bajos', flagEmoji: '🇳🇱', group: 'F', groupPosition: 1, eliminated: false },
  { id: 't-29', code: 'ESP', nameEn: 'Spain', nameEs: 'España', flagEmoji: '🇪🇸', group: 'H', groupPosition: 1, eliminated: false },
  { id: 't-32', code: 'URU', nameEn: 'Uruguay', nameEs: 'Uruguay', flagEmoji: '🇺🇾', group: 'H', groupPosition: 4, eliminated: false },
  { id: 't-33', code: 'FRA', nameEn: 'France', nameEs: 'Francia', flagEmoji: '🇫🇷', group: 'I', groupPosition: 1, eliminated: false },
  { id: 't-37', code: 'ARG', nameEn: 'Argentina', nameEs: 'Argentina', flagEmoji: '🇦🇷', group: 'J', groupPosition: 1, eliminated: false },
  { id: 't-45', code: 'ENG', nameEn: 'England', nameEs: 'Inglaterra', flagEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', group: 'L', groupPosition: 1, eliminated: false }
];

// Helper to find team by code or id
export const getTeamById = (id: string) => mockTeams.find(t => t.id === id) || null;

// 3. Matches Fixtures
export let mockMatches: MatchView[] = [
  // Upcoming unlocked - No prediction yet
  {
    id: 'm-1',
    matchNumber: 1,
    stage: 'group',
    groupLabel: 'A',
    kickoffAt: '2026-06-11T19:00:00Z', // Opening match
    homeTeam: mockTeams[0], // Mexico
    awayTeam: mockTeams[1], // South Africa
    isVoided: false,
    locked: false,
    myPrediction: null,
    result: null,
    pointsEarned: null
  },
  // Upcoming unlocked - With prediction
  {
    id: 'm-2',
    matchNumber: 2,
    stage: 'group',
    groupLabel: 'A',
    kickoffAt: '2026-06-12T13:00:00Z',
    homeTeam: mockTeams[2], // South Korea
    awayTeam: mockTeams[3], // Czech Republic
    isVoided: false,
    locked: false,
    myPrediction: { homeScore: 2, awayScore: 1 },
    result: null,
    pointsEarned: null
  },
  // Upcoming locked - Cannot predict (kickoff time in past or explicitly marked locked)
  {
    id: 'm-3',
    matchNumber: 3,
    stage: 'group',
    groupLabel: 'B',
    kickoffAt: '2026-06-08T18:00:00Z', // Kickoff has passed relative to 2026-06-09
    homeTeam: mockTeams[4], // Canada
    awayTeam: mockTeams[5], // Switzerland
    isVoided: false,
    locked: true,
    myPrediction: { homeScore: 1, awayScore: 1 },
    result: null,
    pointsEarned: null
  },
  // Past match - Exact score predicted (6 points)
  {
    id: 'm-4',
    matchNumber: 4,
    stage: 'group',
    groupLabel: 'C',
    kickoffAt: '2026-06-05T15:00:00Z',
    homeTeam: mockTeams[6], // Brazil
    awayTeam: mockTeams[7], // Morocco
    isVoided: false,
    locked: true,
    myPrediction: { homeScore: 3, awayScore: 1 },
    result: { homeScore: 3, awayScore: 1 },
    pointsEarned: 6
  },
  // Past match - Correct result, wrong score predicted (2 points)
  {
    id: 'm-5',
    matchNumber: 5,
    stage: 'group',
    groupLabel: 'D',
    kickoffAt: '2026-06-06T15:00:00Z',
    homeTeam: mockTeams[8], // USA
    awayTeam: mockTeams[11], // Spain
    isVoided: false,
    locked: true,
    myPrediction: { homeScore: 2, awayScore: 0 },
    result: { homeScore: 1, awayScore: 0 },
    pointsEarned: 2
  },
  // Past match - Wrong result (0 points)
  {
    id: 'm-6',
    matchNumber: 6,
    stage: 'group',
    groupLabel: 'E',
    kickoffAt: '2026-06-07T12:00:00Z',
    homeTeam: mockTeams[9], // Germany
    awayTeam: mockTeams[10], // Netherlands
    isVoided: false,
    locked: true,
    myPrediction: { homeScore: 1, awayScore: 2 },
    result: { homeScore: 2, awayScore: 1 },
    pointsEarned: 0
  },
  // Upcoming knockout stage (multiplier x2) - Unlocked
  {
    id: 'm-7',
    matchNumber: 80,
    stage: 'r32',
    groupLabel: null,
    kickoffAt: '2026-06-28T16:00:00Z',
    homeTeam: mockTeams[14], // Argentina
    awayTeam: mockTeams[12], // Uruguay
    isVoided: false,
    locked: false,
    myPrediction: null,
    result: null,
    pointsEarned: null
  },
  // Knockout stage - Scored with multiplier (predicted 1-1, actual 1-1, exact score = 6 * 2 = 12 points)
  {
    id: 'm-8',
    matchNumber: 81,
    stage: 'r32',
    groupLabel: null,
    kickoffAt: '2026-06-08T20:00:00Z',
    homeTeam: mockTeams[13], // France
    awayTeam: mockTeams[15], // England
    isVoided: false,
    locked: true,
    myPrediction: { homeScore: 1, awayScore: 1 },
    result: { homeScore: 1, awayScore: 1 },
    pointsEarned: 12
  },
  // Knockout TBD match - placeholders, not predictable yet
  {
    id: 'm-9',
    matchNumber: 100,
    stage: 'sf',
    groupLabel: null,
    kickoffAt: '2026-07-14T20:00:00Z',
    homeTeam: null, // Winner Match 95
    awayTeam: null, // Winner Match 96
    isVoided: false,
    locked: true, // TBD matches are locked for prediction
    myPrediction: null,
    result: null,
    pointsEarned: null
  },
  // Voided match
  {
    id: 'm-10',
    matchNumber: 10,
    stage: 'group',
    groupLabel: 'F',
    kickoffAt: '2026-06-15T15:00:00Z',
    homeTeam: mockTeams[10], // Netherlands
    awayTeam: mockTeams[2], // South Korea
    isVoided: true,
    locked: true,
    myPrediction: { homeScore: 2, awayScore: 0 },
    result: null,
    pointsEarned: null
  }
];

export function updateMatchPrediction(matchId: string, homeScore: number, awayScore: number) {
  const match = mockMatches.find(m => m.id === matchId);
  if (match && !match.locked && !match.isVoided) {
    match.myPrediction = { homeScore, awayScore };
  }
}

// 4. Leagues Summary (for dashboard list)
export let mockLeagues: LeagueSummary[] = [
  {
    id: 'league-1',
    name: 'La Polla de los Amigos ⚽️',
    inviteCode: 'AMIGOS',
    language: 'es',
    memberCount: 8,
    myRank: 2,
    myPoints: 20, // 6 (m-4 BRA/MAR) + 2 (m-5 USA/ESP) + 12 (m-8 FRA/ENG)
    isAdmin: true
  },
  {
    id: 'league-2',
    name: 'Workplace WC Pool 🏢',
    inviteCode: 'OFFICE',
    language: 'en',
    memberCount: 24,
    myRank: 5,
    myPoints: 20,
    isAdmin: false
  }
];

// 5. League Details (detailed view for league-1)
export let mockLeagueDetails: Record<string, LeagueDetail> = {
  'league-1': {
    id: 'league-1',
    name: 'La Polla de los Amigos ⚽️',
    inviteCode: 'AMIGOS',
    language: 'es',
    isAdmin: true,
    members: [
      { userId: 'user-me', displayName: 'Danny', isAdmin: true },
      { userId: 'user-2', displayName: 'Sofía', isAdmin: false },
      { userId: 'user-3', displayName: 'Mateo', isAdmin: false },
      { userId: 'user-4', displayName: 'Santiago', isAdmin: false },
      { userId: 'user-5', displayName: 'Valentina', isAdmin: false },
      { userId: 'user-6', displayName: 'Camila', isAdmin: false },
      { userId: 'user-7', displayName: 'Alejandro', isAdmin: false },
      { userId: 'user-8', displayName: 'Lucas', isAdmin: false }
    ],
    leaderboard: [
      { rank: 1, userId: 'user-2', displayName: 'Sofía', totalPoints: 26, matchPoints: 26, bonusPoints: 0, exactCount: 3, resultCount: 4, isMe: false },
      { rank: 2, userId: 'user-me', displayName: 'Danny', totalPoints: 20, matchPoints: 20, bonusPoints: 0, exactCount: 2, resultCount: 1, isMe: true },
      { rank: 3, userId: 'user-3', displayName: 'Mateo', totalPoints: 14, matchPoints: 14, bonusPoints: 0, exactCount: 1, resultCount: 4, isMe: false },
      { rank: 4, userId: 'user-4', displayName: 'Santiago', totalPoints: 12, matchPoints: 12, bonusPoints: 0, exactCount: 2, resultCount: 0, isMe: false },
      { rank: 5, userId: 'user-5', displayName: 'Valentina', totalPoints: 8, matchPoints: 8, bonusPoints: 0, exactCount: 0, resultCount: 4, isMe: false }
    ]
  },
  'league-2': {
    id: 'league-2',
    name: 'Workplace WC Pool 🏢',
    inviteCode: 'OFFICE',
    language: 'en',
    isAdmin: false,
    members: [
      { userId: 'user-9', displayName: 'John Doe', isAdmin: true },
      { userId: 'user-me', displayName: 'Danny', isAdmin: false }
      // ... more members represented by count
    ],
    leaderboard: [
      { rank: 1, userId: 'user-9', displayName: 'John Doe', totalPoints: 32, matchPoints: 32, bonusPoints: 0, exactCount: 4, resultCount: 4, isMe: false },
      { rank: 5, userId: 'user-me', displayName: 'Danny', totalPoints: 20, matchPoints: 20, bonusPoints: 0, exactCount: 2, resultCount: 1, isMe: true }
    ]
  }
};

// 6. Bonus Predictions Fixture
// Change 'locked' to true below to test the locked/read-only state of bonuses.
export let mockBonuses: BonusView = {
  championTeamId: null,
  runnerUpTeamId: null,
  thirdPlaceTeamId: null,
  semifinalists: [],
  topScorerName: '',
  bestPlayerName: '',
  locked: false, // Flip this to true to test the read-only locking behavior
  lockAt: tournamentStartStr
};

export function updateBonuses(updated: Omit<BonusView, 'locked' | 'lockAt'>) {
  if (!mockBonuses.locked) {
    mockBonuses.championTeamId = updated.championTeamId;
    mockBonuses.runnerUpTeamId = updated.runnerUpTeamId;
    mockBonuses.thirdPlaceTeamId = updated.thirdPlaceTeamId;
    mockBonuses.semifinalists = updated.semifinalists;
    mockBonuses.topScorerName = updated.topScorerName;
    mockBonuses.bestPlayerName = updated.bestPlayerName;
  }
}
