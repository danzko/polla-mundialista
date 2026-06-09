import type {
  SessionUser, Team, MatchView, LeagueSummary, LeagueDetail,
  BonusView, ActionResult, Locale, MatchStage,
} from './types';
import {
  currentUser, setCurrentUser, mockTeams, mockMatches,
  mockLeagues, mockLeagueDetails, mockBonuses,
  updateMatchPrediction, updateBonuses
} from './fixtures';
import {
  displayNameSchema, emailSchema, leagueNameSchema,
  inviteCodeSchema, scoreSchema, bonusPredictionsSchema
} from './validation';

// Helper to simulate network latency
const delay = (ms?: number) => {
  const time = ms ?? Math.floor(Math.random() * 250) + 150; // 150ms - 400ms
  return new Promise((resolve) => setTimeout(resolve, time));
};

// ==========================================
// READS
// ==========================================

export async function getSessionUser(): Promise<SessionUser | null> {
  await delay();
  return currentUser;
}

export async function getDashboard(): Promise<LeagueSummary[]> {
  await delay();
  return mockLeagues;
}

export async function getLeague(leagueId: string): Promise<LeagueDetail | null> {
  await delay();
  return mockLeagueDetails[leagueId] || null;
}

export async function getTeams(): Promise<Team[]> {
  await delay();
  return mockTeams;
}

export async function getMatches(
  filter?: { stage?: MatchStage; dateISO?: string }
): Promise<MatchView[]> {
  await delay();
  let matches = [...mockMatches];

  if (filter?.stage) {
    matches = matches.filter(m => m.stage === filter.stage);
  }

  if (filter?.dateISO) {
    const filterDateStr = filter.dateISO.substring(0, 10); // YYYY-MM-DD
    matches = matches.filter(m => m.kickoffAt.substring(0, 10) === filterDateStr);
  }

  // Ensure dates are sorted chronologically
  return matches.sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
}

export async function getBonuses(): Promise<BonusView> {
  await delay();
  return mockBonuses;
}

// ==========================================
// MUTATIONS
// ==========================================

export async function requestMagicLink(
  input: { email: string; locale: Locale }
): Promise<ActionResult> {
  await delay(600); // slightly longer for auth feel
  
  const validation = emailSchema.safeParse(input.email);
  if (!validation.success) {
    return { ok: false, error: 'Email inválido / Invalid email' };
  }

  // Simulate success
  console.log(`[MOCK] Magic link sent to ${validation.data} with locale ${input.locale}`);
  return { ok: true, data: undefined };
}

export async function completeOnboarding(
  input: { displayName: string; preferredLanguage: Locale }
): Promise<ActionResult<SessionUser>> {
  await delay(500);

  const displayValidation = displayNameSchema.safeParse(input.displayName);
  if (!displayValidation.success) {
    return {
      ok: false,
      error: displayValidation.error.issues[0]?.message || 'Nombre inválido / Invalid name',
      fieldErrors: { displayName: displayValidation.error.issues[0]?.message || 'Nombre inválido' }
    };
  }

  // Set current user
  const newUser: SessionUser = {
    id: currentUser?.id || 'user-me',
    displayName: displayValidation.data,
    preferredLanguage: input.preferredLanguage,
    isSuperadmin: currentUser?.isSuperadmin ?? false,
    onboarded: true
  };
  
  setCurrentUser(newUser);
  return { ok: true, data: newUser };
}

export async function createLeague(
  input: { name: string; language: Locale }
): Promise<ActionResult<{ leagueId: string; inviteCode: string }>> {
  await delay(500);

  const nameValidation = leagueNameSchema.safeParse(input.name);
  if (!nameValidation.success) {
    return {
      ok: false,
      error: nameValidation.error.issues[0]?.message || 'Nombre de liga inválido / Invalid league name',
      fieldErrors: { name: nameValidation.error.issues[0]?.message || 'Nombre de liga inválido' }
    };
  }

  // Generate invite code
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const id = `league-${Date.now()}`;

  const newSummary: LeagueSummary = {
    id,
    name: nameValidation.data,
    inviteCode: code,
    language: input.language,
    memberCount: 1,
    myRank: 1,
    myPoints: 0,
    isAdmin: true
  };

  const newDetail: LeagueDetail = {
    id,
    name: nameValidation.data,
    inviteCode: code,
    language: input.language,
    isAdmin: true,
    members: [
      { userId: currentUser?.id || 'user-me', displayName: currentUser?.displayName || 'Danny', isAdmin: true }
    ],
    leaderboard: [
      { rank: 1, userId: currentUser?.id || 'user-me', displayName: currentUser?.displayName || 'Danny', totalPoints: 0, matchPoints: 0, bonusPoints: 0, exactCount: 0, resultCount: 0, isMe: true }
    ]
  };

  mockLeagues.push(newSummary);
  mockLeagueDetails[id] = newDetail;

  return { ok: true, data: { leagueId: id, inviteCode: code } };
}

export async function joinLeague(
  input: { inviteCode: string }
): Promise<ActionResult<{ leagueId: string }>> {
  await delay(500);

  const codeValidation = inviteCodeSchema.safeParse(input.inviteCode);
  if (!codeValidation.success) {
    return {
      ok: false,
      error: codeValidation.error.issues[0]?.message || 'Código inválido / Invalid code',
      fieldErrors: { inviteCode: codeValidation.error.issues[0]?.message || 'Código inválido' }
    };
  }

  const code = codeValidation.data;

  // Search existing summaries
  const targetLeague = mockLeagues.find(l => l.inviteCode === code);
  if (!targetLeague) {
    return {
      ok: false,
      error: input.inviteCode === 'ERROR6' 
        ? 'Error de conexión / Connection error'
        : 'Código de invitación no encontrado / Invite code not found'
    };
  }

  // Check if already in league
  const detail = mockLeagueDetails[targetLeague.id];
  if (detail) {
    const isMember = detail.members.some(m => m.userId === (currentUser?.id || 'user-me'));
    if (isMember) {
      return { ok: true, data: { leagueId: targetLeague.id } }; // Quietly succeed
    }

    // Add user as member
    detail.members.push({
      userId: currentUser?.id || 'user-me',
      displayName: currentUser?.displayName || 'Danny',
      isAdmin: false
    });
    
    // Add user to leaderboard
    detail.leaderboard.push({
      rank: detail.leaderboard.length + 1,
      userId: currentUser?.id || 'user-me',
      displayName: currentUser?.displayName || 'Danny',
      totalPoints: targetLeague.myPoints, // Assume current user points
      matchPoints: targetLeague.myPoints,
      bonusPoints: 0,
      exactCount: 2,
      resultCount: 1,
      isMe: true
    });

    targetLeague.memberCount += 1;
    targetLeague.myRank = detail.leaderboard.length;
  }

  return { ok: true, data: { leagueId: targetLeague.id } };
}

export async function submitPrediction(
  input: { matchId: string; homeScore: number; awayScore: number }
): Promise<ActionResult> {
  await delay(300);

  const homeVal = scoreSchema.safeParse(input.homeScore);
  const awayVal = scoreSchema.safeParse(input.awayScore);

  if (!homeVal.success || !awayVal.success) {
    return { ok: false, error: 'Marcador inválido / Invalid scores (0-15)' };
  }

  const match = mockMatches.find(m => m.id === input.matchId);
  if (!match) {
    return { ok: false, error: 'Partido no encontrado / Match not found' };
  }

  if (match.locked || match.isVoided) {
    return { ok: false, error: 'El partido está bloqueado para predicciones / Match is locked for predictions' };
  }

  // Update in fixtures
  updateMatchPrediction(input.matchId, input.homeScore, input.awayScore);
  
  return { ok: true, data: undefined };
}

export async function submitBonuses(
  input: Omit<BonusView, 'locked' | 'lockAt'>
): Promise<ActionResult> {
  await delay(500);

  const validation = bonusPredictionsSchema.safeParse(input);
  if (!validation.success) {
    return {
      ok: false,
      error: validation.error.issues[0]?.message || 'Picks de bonos inválidos / Invalid bonus picks'
    };
  }

  if (mockBonuses.locked) {
    return { ok: false, error: 'Los bonos ya están bloqueados / Bonuses are already locked' };
  }

  // Update in fixtures
  updateBonuses(input);

  return { ok: true, data: undefined };
}
