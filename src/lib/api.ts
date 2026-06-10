"use server";

import { headers } from "next/headers";
import { createClient } from "./supabase/server";
import type {
  SessionUser, Team, MatchView, LeagueSummary, LeagueDetail,
  BonusView, ActionResult, Locale, MatchStage, LeaderboardRow,
  LeagueMemberView,
} from "./types";
import {
  displayNameSchema, emailSchema, leagueNameSchema,
  inviteCodeSchema, scoreSchema, bonusPredictionsSchema
} from "./validation";
import { calculateMatchPoints } from "./scoring/calculate-points";

// ==========================================
// READS
// ==========================================

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !profile) {
      // Authenticated but onboarding profile doesn't exist yet
      return {
        id: user.id,
        displayName: "",
        preferredLanguage: "es",
        isSuperadmin: false,
        onboarded: false,
      };
    }

    return {
      id: profile.id,
      displayName: profile.display_name,
      preferredLanguage: profile.preferred_language as Locale,
      isSuperadmin: profile.is_superadmin,
      onboarded: true,
    };
  } catch (err) {
    console.error("Error in getSessionUser:", err);
    return null;
  }
}

export async function getDashboard(): Promise<LeagueSummary[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Fetch all leagues the user belongs to
    const { data: memberships, error } = await supabase
      .from("league_members")
      .select(`
        league_id,
        leagues (
          id,
          name,
          invite_code,
          language,
          admin_user_id
        )
      `)
      .eq("user_id", user.id);

    if (error || !memberships) {
      console.error("Error fetching memberships:", error);
      return [];
    }

    const summaries: LeagueSummary[] = [];

    for (const m of memberships) {
      const league = m.leagues as any;
      if (!league) continue;

      // Fetch all member IDs in this league
      const { data: members } = await supabase
        .from("league_members")
        .select("user_id")
        .eq("league_id", league.id);

      const memberIds = members?.map((mem) => mem.user_id) || [];

      // Fetch leaderboard standings for these members
      const { data: scores } = await supabase
        .from("leaderboard_view")
        .select("*")
        .in("user_id", memberIds);

      const scoresMap = new Map(scores?.map((s) => [s.user_id, s]) ?? []);

      const standings = memberIds.map((mId) => {
        const score = scoresMap.get(mId);
        return {
          userId: mId,
          totalPoints: score?.total_points ?? 0,
          exactCount: score?.exact_count ?? 0,
          resultCount: score?.result_count ?? 0,
          firstPredictionAt: score?.first_prediction_at
            ? new Date(score.first_prediction_at).getTime()
            : Infinity,
        };
      });

      // Sort according to tiebreaker rules: points DESC, exact DESC, result DESC, first pred ASC
      standings.sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
        if (b.resultCount !== a.resultCount) return b.resultCount - a.resultCount;
        return a.firstPredictionAt - b.firstPredictionAt;
      });

      const myIndex = standings.findIndex((s) => s.userId === user.id);
      const myRank = myIndex !== -1 ? myIndex + 1 : null;
      const myPoints = myIndex !== -1 ? standings[myIndex].totalPoints : 0;

      summaries.push({
        id: league.id,
        name: league.name,
        inviteCode: league.invite_code,
        language: league.language as Locale,
        memberCount: standings.length,
        myRank,
        myPoints,
        isAdmin: league.admin_user_id === user.id,
      });
    }

    return summaries;
  } catch (err) {
    console.error("Error in getDashboard:", err);
    return [];
  }
}

export async function getLeague(leagueId: string): Promise<LeagueDetail | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: league, error } = await supabase
      .from("leagues")
      .select("*")
      .eq("id", leagueId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !league) {
      return null;
    }

    const { data: members } = await supabase
      .from("league_members")
      .select(`
        user_id,
        users (
          display_name
        )
      `)
      .eq("league_id", leagueId);

    if (!members) return null;

    const memberIds = members.map((m) => m.user_id);

    const { data: scores } = await supabase
      .from("leaderboard_view")
      .select("*")
      .in("user_id", memberIds);

    const scoresMap = new Map(scores?.map((s) => [s.user_id, s]) ?? []);

    const leaderboard: LeaderboardRow[] = members.map((m) => {
      const score = scoresMap.get(m.user_id);
      return {
        rank: 0,
        userId: m.user_id,
        displayName: (m.users as any)?.display_name || "Usuario / User",
        totalPoints: score?.total_points ?? 0,
        matchPoints: score?.total_points ?? 0,
        bonusPoints: 0,
        exactCount: score?.exact_count ?? 0,
        resultCount: score?.result_count ?? 0,
        isMe: m.user_id === user.id,
      };
    });

    const firstPredMap = new Map(
      scores?.map((s) => [
        s.user_id,
        s.first_prediction_at ? new Date(s.first_prediction_at).getTime() : Infinity,
      ]) ?? []
    );

    leaderboard.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
      if (b.resultCount !== a.resultCount) return b.resultCount - a.resultCount;
      const tA = firstPredMap.get(a.userId) ?? Infinity;
      const tB = firstPredMap.get(b.userId) ?? Infinity;
      return tA - tB;
    });

    leaderboard.forEach((row, i) => {
      row.rank = i + 1;
    });

    const membersList: LeagueMemberView[] = members.map((m) => ({
      userId: m.user_id,
      displayName: (m.users as any)?.display_name || "Usuario / User",
      isAdmin: m.user_id === league.admin_user_id,
    }));

    return {
      id: league.id,
      name: league.name,
      inviteCode: league.invite_code,
      language: league.language as Locale,
      isAdmin: league.admin_user_id === user.id,
      members: membersList,
      leaderboard,
    };
  } catch (err) {
    console.error("Error in getLeague:", err);
    return null;
  }
}

export async function getTeams(): Promise<Team[]> {
  try {
    const supabase = await createClient();
    const { data: dbTeams, error } = await supabase
      .from("teams")
      .select("*")
      .order("group", { ascending: true })
      .order("group_position", { ascending: true });

    if (error || !dbTeams) {
      console.error("Error fetching teams:", error);
      return [];
    }

    return dbTeams.map((t) => ({
      id: t.id,
      code: t.code,
      nameEn: t.name_en,
      nameEs: t.name_es,
      flagEmoji: t.flag_emoji,
      group: t.group,
      groupPosition: t.group_position,
      eliminated: t.eliminated,
    }));
  } catch (err) {
    console.error("Error in getTeams:", err);
    return [];
  }
}

export async function getMatches(
  filter?: { stage?: MatchStage; dateISO?: string }
): Promise<MatchView[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let query = supabase
      .from("matches")
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey (*),
        away_team:teams!matches_away_team_id_fkey (*),
        match_results (*)
      `);

    if (filter?.stage) {
      query = query.eq("stage", filter.stage);
    }

    const { data: dbMatches, error } = await query;
    if (error || !dbMatches) {
      console.error("Error fetching matches:", error);
      return [];
    }

    let predictionsMap = new Map<string, any>();
    if (user) {
      const { data: preds } = await supabase
        .from("predictions")
        .select("*")
        .eq("user_id", user.id);

      predictionsMap = new Map(preds?.map((p) => [p.match_id, p]) ?? []);
    }

    const now = new Date();

    const matches: MatchView[] = dbMatches.map((m: any) => {
      const homeTeam = m.home_team
        ? {
            id: m.home_team.id,
            code: m.home_team.code,
            nameEn: m.home_team.name_en,
            nameEs: m.home_team.name_es,
            flagEmoji: m.home_team.flag_emoji,
            group: m.home_team.group,
            groupPosition: m.home_team.group_position,
            eliminated: m.home_team.eliminated,
          }
        : null;

      const awayTeam = m.away_team
        ? {
            id: m.away_team.id,
            code: m.away_team.code,
            nameEn: m.away_team.name_en,
            nameEs: m.away_team.name_es,
            flagEmoji: m.away_team.flag_emoji,
            group: m.away_team.group,
            groupPosition: m.away_team.group_position,
            eliminated: m.away_team.eliminated,
          }
        : null;

      const kickoffDate = new Date(m.kickoff_at);
      const locked = m.is_voided || kickoffDate <= now;

      const pred = predictionsMap.get(m.id);
      const myPrediction = pred
        ? {
            homeScore: pred.home_score,
            awayScore: pred.away_score,
          }
        : null;

      const result = m.match_results
        ? {
            homeScore: m.match_results.home_score,
            awayScore: m.match_results.away_score,
          }
        : null;

      let pointsEarned: number | null = null;
      if (myPrediction && result) {
        pointsEarned = calculateMatchPoints(myPrediction, result, m.stage as any).totalPoints;
      }

      return {
        id: m.id,
        matchNumber: m.match_number,
        stage: m.stage as MatchStage,
        groupLabel: m.group_label,
        kickoffAt: m.kickoff_at,
        homeTeam,
        awayTeam,
        isVoided: m.is_voided,
        locked,
        myPrediction,
        result,
        pointsEarned,
      };
    });

    let filteredMatches = matches;
    if (filter?.dateISO) {
      const filterDateStr = filter.dateISO.substring(0, 10);
      filteredMatches = matches.filter(
        (m) => m.kickoffAt.substring(0, 10) === filterDateStr
      );
    }

    return filteredMatches.sort((a, b) => {
      const diff = new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime();
      if (diff !== 0) return diff;
      return a.matchNumber - b.matchNumber;
    });
  } catch (err) {
    console.error("Error in getMatches:", err);
    return [];
  }
}

export async function getBonuses(): Promise<BonusView> {
  const lockAt = "2026-06-11T19:00:00Z";
  const locked = new Date() >= new Date(lockAt);

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        championTeamId: null,
        runnerUpTeamId: null,
        thirdPlaceTeamId: null,
        semifinalists: [],
        topScorerNames: [],
        bestPlayerNames: [],
        locked,
        lockAt,
      };
    }

    const { data: pred, error } = await supabase
      .from("bonus_predictions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !pred) {
      return {
        championTeamId: null,
        runnerUpTeamId: null,
        thirdPlaceTeamId: null,
        semifinalists: [],
        topScorerNames: [],
        bestPlayerNames: [],
        locked,
        lockAt,
      };
    }

    return {
      championTeamId: pred.champion_team_id,
      runnerUpTeamId: pred.runner_up_team_id,
      thirdPlaceTeamId: pred.third_place_team_id,
      semifinalists: (pred.semifinalists as string[]) || [],
      topScorerNames: (pred.top_scorer_names as string[]) || [],
      bestPlayerNames: (pred.best_player_names as string[]) || [],
      locked,
      lockAt,
    };
  } catch (err) {
    console.error("Error in getBonuses:", err);
    return {
      championTeamId: null,
      runnerUpTeamId: null,
      thirdPlaceTeamId: null,
      semifinalists: [],
      topScorerNames: [],
      bestPlayerNames: [],
      locked,
      lockAt,
    };
  }
}

// ==========================================
// MUTATIONS
// ==========================================

async function checkUserProfile(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  return !!data;
}

// Unambiguous alphabet: no I, L, O, 0, 1 (easy to read aloud / type on a phone)
const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  }
  return code;
}

export async function requestMagicLink(
  input: { email: string; locale: Locale }
): Promise<ActionResult> {
  const validation = emailSchema.safeParse(input.email);
  if (!validation.success) {
    return { ok: false, error: "Email inválido / Invalid email" };
  }

  try {
    const supabase = await createClient();

    const headersList = await headers();
    const origin = headersList.get("origin") || headersList.get("referer");
    let redirectUrl = "";
    if (origin) {
      const originUrl = new URL(origin);
      redirectUrl = `${originUrl.origin}/api/auth/callback?next=/${input.locale}/dashboard`;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: validation.data,
      options: {
        emailRedirectTo: redirectUrl || undefined,
      },
    });

    if (error) {
      console.error("Magic link request error:", error);
      return { ok: false, error: error.message };
    }

    return { ok: true, data: undefined };
  } catch (err: any) {
    console.error("Magic link exception:", err);
    return {
      ok: false,
      error: err.message || "Error al enviar enlace / Error sending link",
    };
  }
}

export async function completeOnboarding(
  input: { displayName: string; preferredLanguage: Locale }
): Promise<ActionResult<SessionUser>> {
  const displayValidation = displayNameSchema.safeParse(input.displayName);
  if (!displayValidation.success) {
    return {
      ok: false,
      error: displayValidation.error.issues[0]?.message || "Nombre inválido / Invalid name",
      fieldErrors: { displayName: displayValidation.error.issues[0]?.message || "Nombre inválido" },
    };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "No autenticado / Not authenticated" };
    }

    const { error } = await supabase
      .from("users")
      .upsert({
        id: user.id,
        display_name: displayValidation.data,
        preferred_language: input.preferredLanguage,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error("Onboarding error:", error);
      return { ok: false, error: error.message };
    }

    return {
      ok: true,
      data: {
        id: user.id,
        displayName: displayValidation.data,
        preferredLanguage: input.preferredLanguage,
        isSuperadmin: false,
        onboarded: true,
      },
    };
  } catch (err: any) {
    console.error("Onboarding exception:", err);
    return {
      ok: false,
      error: err.message || "Error en onboarding / Error in onboarding",
    };
  }
}

export async function createLeague(
  input: { name: string; language: Locale }
): Promise<ActionResult<{ leagueId: string; inviteCode: string }>> {
  const nameValidation = leagueNameSchema.safeParse(input.name);
  if (!nameValidation.success) {
    return {
      ok: false,
      error: nameValidation.error.issues[0]?.message || "Nombre de liga inválido / Invalid league name",
      fieldErrors: { name: nameValidation.error.issues[0]?.message || "Nombre de liga inválido" },
    };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "No autenticado / Not authenticated" };
    }

    const hasProfile = await checkUserProfile(supabase, user.id);
    if (!hasProfile) {
      return { ok: false, error: "Debes completar tu perfil antes de continuar / Please complete onboarding first" };
    }

    let league: any = null;
    let leagueError: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const inviteCode = generateInviteCode();
      const { data, error } = await supabase
        .from("leagues")
        .insert({
          name: nameValidation.data,
          invite_code: inviteCode,
          language: input.language,
          created_by: user.id,
          admin_user_id: user.id,
        })
        .select()
        .single();

      if (!error && data) {
        league = data;
        break;
      }
      leagueError = error;
      // 23505 = unique violation on invite_code; try a fresh code
      if (error?.code !== "23505") break;
    }

    if (!league) {
      console.error("Create league error:", leagueError);
      return {
        ok: false,
        error: leagueError?.message || "Error al crear liga / Error creating league",
      };
    }

    const { error: memberError } = await supabase
      .from("league_members")
      .insert({
        league_id: league.id,
        user_id: user.id,
      });

    if (memberError) {
      console.error("Create league member error:", memberError);
      return { ok: false, error: memberError.message };
    }

    return {
      ok: true,
      data: {
        leagueId: league.id,
        inviteCode: league.invite_code,
      },
    };
  } catch (err: any) {
    console.error("Create league exception:", err);
    return {
      ok: false,
      error: err.message || "Error al crear liga / Error creating league",
    };
  }
}

export async function joinLeague(
  input: { inviteCode: string }
): Promise<ActionResult<{ leagueId: string }>> {
  const codeValidation = inviteCodeSchema.safeParse(input.inviteCode);
  if (!codeValidation.success) {
    return {
      ok: false,
      error: codeValidation.error.issues[0]?.message || "Código inválido / Invalid code",
      fieldErrors: { inviteCode: codeValidation.error.issues[0]?.message || "Código inválido" },
    };
  }

  const code = codeValidation.data.toUpperCase();

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "No autenticado / Not authenticated" };
    }

    const hasProfile = await checkUserProfile(supabase, user.id);
    if (!hasProfile) {
      return { ok: false, error: "Debes completar tu perfil antes de continuar / Please complete onboarding first" };
    }

    // RLS only lets members see a league, so a direct select by invite code
    // returns nothing for non-members. Look it up via the SECURITY DEFINER
    // RPC instead (exact-code match only, signed-in users only).
    const { data: league, error: leagueError } = await supabase
      .rpc("lookup_league_by_invite_code", { p_code: code })
      .maybeSingle<{
        id: string;
        name: string;
        invite_code: string;
        language: string;
        admin_user_id: string;
      }>();

    if (leagueError || !league) {
      return {
        ok: false,
        error: "Código de invitación no encontrado / Invite code not found",
      };
    }

    const { data: existingMember } = await supabase
      .from("league_members")
      .select("*")
      .eq("league_id", league.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingMember) {
      return { ok: true, data: { leagueId: league.id } };
    }

    const { error: joinError } = await supabase
      .from("league_members")
      .insert({
        league_id: league.id,
        user_id: user.id,
      });

    if (joinError) {
      // 23505 = already a member (double-tap race); treat as success
      if (joinError.code === "23505") {
        return { ok: true, data: { leagueId: league.id } };
      }
      console.error("Join league error:", joinError);
      return { ok: false, error: joinError.message };
    }

    return { ok: true, data: { leagueId: league.id } };
  } catch (err: any) {
    console.error("Join league exception:", err);
    return {
      ok: false,
      error: err.message || "Error al unirse a la liga / Error joining league",
    };
  }
}

export async function submitPrediction(
  input: { matchId: string; homeScore: number; awayScore: number }
): Promise<ActionResult> {
  const homeVal = scoreSchema.safeParse(input.homeScore);
  const awayVal = scoreSchema.safeParse(input.awayScore);

  if (!homeVal.success || !awayVal.success) {
    return { ok: false, error: "Marcador inválido / Invalid scores (0-15)" };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "No autenticado / Not authenticated" };
    }

    const hasProfile = await checkUserProfile(supabase, user.id);
    if (!hasProfile) {
      return { ok: false, error: "Debes completar tu perfil antes de continuar / Please complete onboarding first" };
    }

    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("id", input.matchId)
      .single();

    if (matchError || !match) {
      return { ok: false, error: "Partido no encontrado / Match not found" };
    }

    if (match.is_voided || new Date(match.kickoff_at) <= new Date()) {
      return {
        ok: false,
        error: "El partido está bloqueado para predicciones / Match is locked for predictions",
      };
    }

    const { error: upsertError } = await supabase
      .from("predictions")
      .upsert({
        user_id: user.id,
        match_id: input.matchId,
        home_score: input.homeScore,
        away_score: input.awayScore,
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      console.error("Submit prediction error:", upsertError);
      return { ok: false, error: upsertError.message };
    }

    return { ok: true, data: undefined };
  } catch (err: any) {
    console.error("Submit prediction exception:", err);
    return {
      ok: false,
      error: err.message || "Error al guardar predicción / Error saving prediction",
    };
  }
}

export async function submitBonuses(
  input: Omit<BonusView, "locked" | "lockAt">
): Promise<ActionResult> {
  const validation = bonusPredictionsSchema.safeParse(input);
  if (!validation.success) {
    return {
      ok: false,
      error: validation.error.issues[0]?.message || "Picks de bonos inválidos / Invalid bonus picks",
    };
  }

  const lockAt = "2026-06-11T19:00:00Z";
  if (new Date() >= new Date(lockAt)) {
    return { ok: false, error: "Los bonos ya están bloqueados / Bonuses are already locked" };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "No autenticado / Not authenticated" };
    }

    const hasProfile = await checkUserProfile(supabase, user.id);
    if (!hasProfile) {
      return { ok: false, error: "Debes completar tu perfil antes de continuar / Please complete onboarding first" };
    }

    const picks = validation.data;
    const topScorers = picks.topScorerNames.filter((s) => s !== "");
    const bestPlayers = picks.bestPlayerNames.filter((s) => s !== "");

    const { error: upsertError } = await supabase
      .from("bonus_predictions")
      .upsert({
        user_id: user.id,
        champion_team_id: picks.championTeamId,
        runner_up_team_id: picks.runnerUpTeamId,
        third_place_team_id: picks.thirdPlaceTeamId,
        semifinalists: picks.semifinalists.filter((s) => s !== ""),
        top_scorer_names: topScorers,
        best_player_names: bestPlayers,
        // legacy single-pick columns: keep in sync with the gold pick
        top_scorer_name: topScorers[0] ?? null,
        best_player_name: bestPlayers[0] ?? null,
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      console.error("Submit bonuses error:", upsertError);
      return { ok: false, error: upsertError.message };
    }

    return { ok: true, data: undefined };
  } catch (err: any) {
    console.error("Submit bonuses exception:", err);
    return {
      ok: false,
      error: err.message || "Error al guardar bonos / Error saving bonuses",
    };
  }
}

export async function submitPredictions(
  input: { predictions: { matchId: string; homeScore: number; awayScore: number }[] }
): Promise<ActionResult<{ saved: number; skipped: string[] }>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "No autenticado / Not authenticated" };

    const hasProfile = await checkUserProfile(supabase, user.id);
    if (!hasProfile) {
      return { ok: false, error: "Debes completar tu perfil antes de continuar / Please complete onboarding first" };
    }

    for (const p of input.predictions) {
      if (!scoreSchema.safeParse(p.homeScore).success || !scoreSchema.safeParse(p.awayScore).success) {
        return { ok: false, error: "Marcador inválido / Invalid score (0-15)" };
      }
    }

    const ids = input.predictions.map((p) => p.matchId);
    const { data: matches } = await supabase
      .from("matches")
      .select("id, kickoff_at, is_voided")
      .in("id", ids);

    const now = Date.now();
    const openIds = new Set(
      (matches ?? [])
        .filter((m) => !m.is_voided && new Date(m.kickoff_at).getTime() > now)
        .map((m) => m.id)
    );

    const rows = input.predictions
      .filter((p) => openIds.has(p.matchId))
      .map((p) => ({
        user_id: user.id,
        match_id: p.matchId,
        home_score: p.homeScore,
        away_score: p.awayScore,
        updated_at: new Date().toISOString(),
      }));
    const skipped = input.predictions.filter((p) => !openIds.has(p.matchId)).map((p) => p.matchId);

    if (rows.length > 0) {
      const { error } = await supabase.from("predictions").upsert(rows);
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true, data: { saved: rows.length, skipped } };
  } catch (err: any) {
    return { ok: false, error: err.message || "Error al guardar / Error saving" };
  }
}

