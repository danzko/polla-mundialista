"use server";

import { headers } from "next/headers";
import { createClient } from "./supabase/server";
import type {
  SessionUser, Team, MatchView, LeagueSummary, LeagueDetail,
  BonusView, ActionResult, Locale, MatchStage, LeaderboardRow,
  LeagueMemberView, MatchPickRow, LiveScore, LiveScoresPayload,
  BracketView, BracketMatchView, BracketComparison, BracketPeer,
  UnifiedLeaderboardEntry, LeaderboardData,
  StatsData, TitleRaceRow, BootRaceRow, PickShare,
} from "./types";
import { ADVANCEMENT_POINTS_BY_MATCH } from "./bracket";
import {
  displayNameSchema, emailSchema, leagueNameSchema,
  inviteCodeSchema, scoreSchema, bonusPredictionsSchema
} from "./validation";
import { calculateMatchPoints } from "./scoring/calculate-points";
import { TOURNAMENT_START_ISO, LOCK_BEFORE_KICKOFF_MS, BRACKET_ENTRY_DEADLINE_ISO } from "./tournament";

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
        nameChangeUsed: false,
      };
    }

    return {
      id: profile.id,
      displayName: profile.display_name,
      preferredLanguage: profile.preferred_language as Locale,
      isSuperadmin: profile.is_superadmin,
      onboarded: true,
      nameChangeUsed: profile.name_changed_at !== null,
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
          knockoutPoints: score?.knockout_points ?? 0,
          exactCount: score?.exact_count ?? 0,
          resultCount: score?.result_count ?? 0,
          firstPredictionAt: score?.first_prediction_at
            ? new Date(score.first_prediction_at).getTime()
            : Infinity,
        };
      });

      // Tiebreakers (official rules): total DESC, then knockout-stage points
      // DESC, then exact DESC, result DESC, earliest first prediction ASC.
      standings.sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.knockoutPoints !== a.knockoutPoints) return b.knockoutPoints - a.knockoutPoints;
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
        matchPoints: score?.match_points ?? 0,
        bonusPoints: score?.bonus_points ?? 0,
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
    const knockoutMap = new Map(scores?.map((s) => [s.user_id, s.knockout_points ?? 0]) ?? []);

    // Tiebreakers (official rules): total DESC, then knockout-stage points DESC,
    // then exact DESC, result DESC, earliest first prediction ASC.
    leaderboard.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      const kA = knockoutMap.get(a.userId) ?? 0;
      const kB = knockoutMap.get(b.userId) ?? 0;
      if (kB !== kA) return kB - kA;
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
      // Picks close 15 min before each kickoff and never reopen. This applies
      // to EVERY stage now: knockout SCORELINES are predicted per round on the
      // real fixtures (the big advancement points live in the bracket). A
      // knockout match only opens once both its teams are assigned.
      const teamsAssigned = !!homeTeam && !!awayTeam;
      const locked =
        m.is_voided ||
        !teamsAssigned ||
        now.getTime() >= kickoffDate.getTime() - LOCK_BEFORE_KICKOFF_MS;

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
        // Every match (group + knockout) scores 6/2/0 on the scoreline — no
        // knockout multiplier and no special bonus (owner decision).
        pointsEarned = calculateMatchPoints(myPrediction, result).totalPoints;
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

/**
 * For every started/past GROUP match, a row for EVERY member of the
 * viewer's leagues — the deduped UNION across all the leagues the viewer
 * is in (live leagues only, includes the viewer). League-mates who never
 * entered a pick for a match still appear, with null scores, so the strip
 * always shows the whole league, not just who bothered to play. A person
 * never sees anyone from leagues they're not in. The PicksStrip judges
 * each pick against the live-or-final score client-side. Knockouts
 * excluded. Returns matchId -> rows.
 */
export async function getMatchPicks(): Promise<Record<string, MatchPickRow[]>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};

    // Leagues the viewer belongs to → the union of their members.
    const { data: myLeagues } = await supabase
      .from("league_members").select("league_id").eq("user_id", user.id);
    const candidateLeagueIds = (myLeagues ?? []).map((r) => r.league_id);
    if (candidateLeagueIds.length === 0) return {};

    // Drop soft-deleted leagues (RLS only returns live ones) so a defunct
    // league can never widen who you see.
    const { data: liveLeagues } = await supabase
      .from("leagues").select("id").in("id", candidateLeagueIds);
    const leagueIds = (liveLeagues ?? []).map((l) => l.id);
    if (leagueIds.length === 0) return {};

    const { data: memberRows } = await supabase
      .from("league_members").select("user_id").in("league_id", leagueIds);
    const memberIds = Array.from(new Set((memberRows ?? []).map((r) => r.user_id)));
    if (memberIds.length === 0) return {};

    const nowIso = new Date().toISOString();
    // Reveal picks for ANY started match, group OR knockout — knockout
    // scorelines live in the same `predictions` table and are scored 6/2/0
    // like group games, so the strips must show them too once kickoff passes.
    const { data: startedMatches } = await supabase
      .from("matches")
      .select("id")
      .eq("is_voided", false)
      .lte("kickoff_at", nowIso);
    const startedIds = (startedMatches ?? []).map((m) => m.id);
    if (startedIds.length === 0) return {};

    // Page through predictions: members × started matches can exceed the
    // 1000-row response cap (e.g. 24 league-mates × 47 games = 1125),
    // which would silently drop picks and show real entrants as "no pick".
    const preds: Array<{ user_id: string; match_id: string; home_score: number; away_score: number }> = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("predictions")
        .select("user_id, match_id, home_score, away_score")
        .in("match_id", startedIds)
        .in("user_id", memberIds)
        .order("match_id", { ascending: true })
        .order("user_id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      preds.push(...data);
      if (data.length < PAGE) break;
    }

    const { data: userRows } = await supabase
      .from("users").select("id, display_name").in("id", memberIds);
    const nameById = new Map((userRows ?? []).map((u) => [u.id, u.display_name as string]));

    const predByKey = new Map<string, { h: number; a: number }>();
    for (const p of preds) {
      predByKey.set(`${p.match_id}:${p.user_id}`, { h: p.home_score, a: p.away_score });
    }

    // Every league-mate appears for every started match — pick or not.
    const byMatch: Record<string, MatchPickRow[]> = {};
    for (const mid of startedIds) {
      byMatch[mid] = memberIds.map((uid) => {
        const pk = predByKey.get(`${mid}:${uid}`);
        return {
          userId: uid,
          displayName: nameById.get(uid) ?? "—",
          homeScore: pk ? pk.h : null,
          awayScore: pk ? pk.a : null,
          points: null,
          outcome: "pending" as const,
        };
      });
    }
    return byMatch;
  } catch (err) {
    console.error("Error in getMatchPicks:", err);
    return {};
  }
}

/**
 * Real-time scores for the live feed. Reads the live_scores staging table
 * (filled by the ESPN sync every 2 min) + the heartbeat. Cheap enough to
 * poll from the client every ~30s. Authenticated read (RLS).
 */
export async function getLiveScores(): Promise<LiveScoresPayload> {
  try {
    const supabase = await createClient();
    const [{ data: rows }, { data: state }] = await Promise.all([
      supabase
        .from("live_scores")
        .select("match_id, status, home_score, away_score, display_clock, completed"),
      supabase.from("live_sync_state").select("last_run_at").eq("id", 1).maybeSingle(),
    ]);
    const scores: Record<string, LiveScore> = {};
    for (const r of rows ?? []) {
      scores[r.match_id] = {
        status: (r.status as LiveScore["status"]) ?? "pre",
        homeScore: r.home_score,
        awayScore: r.away_score,
        displayClock: r.display_clock,
        completed: !!r.completed,
      };
    }
    return { scores, lastRunAt: state?.last_run_at ?? null };
  } catch (err) {
    console.error("Error in getLiveScores:", err);
    return { scores: {}, lastRunAt: null };
  }
}

/**
 * One-time display-name change. Routes through the change_display_name
 * RPC, which enforces the one-time rule at the DB regardless of caller.
 */
export async function changeDisplayName(input: { name: string }): Promise<ActionResult> {
  const parsed = displayNameSchema.safeParse(input.name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Nombre inválido / Invalid name" };
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "No autenticado / Not authenticated" };

    const { error } = await supabase.rpc("change_display_name", { p_name: parsed.data });
    if (error) {
      const already = error.message.includes("already changed");
      return {
        ok: false,
        error: already
          ? "Ya usaste tu único cambio de nombre / You already used your one name change"
          : error.message,
      };
    }
    return { ok: true, data: undefined };
  } catch (err: any) {
    return { ok: false, error: err.message || "Error al cambiar el nombre / Error changing name" };
  }
}

/**
 * The knockout bracket: every KO match (73–104) with its real participants
 * (once groups conclude / rounds resolve) plus the viewer's own pick, and
 * the lock state (locks at the first R32 kickoff). The client derives
 * later-round participants from the player's advancers via the bracket tree.
 */
export async function getBracket(): Promise<BracketView> {
  const empty: BracketView = { lockAt: null, locked: false, matches: [] };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return empty;

    const { data: matchRows } = await supabase
      .from("matches")
      .select("id, match_number, stage, kickoff_at, home_team_id, away_team_id")
      .neq("stage", "group")
      .order("match_number", { ascending: true });

    const { data: picks } = await supabase
      .from("bracket_picks")
      .select("match_id, advancer_team_id, home_score, away_score")
      .eq("user_id", user.id);
    const pickByMatch = new Map(
      (picks ?? []).map((p) => [p.match_id, p])
    );

    // Per-match lock: each pick locks at min(entry deadline, its kickoff-15m).
    // `lockAt` here is the overall entry deadline (when the whole bracket
    // closes); the client derives each game's own lock from its kickoff. Read
    // the EFFECTIVE deadline from the DB so per-user admin grace is honored;
    // fall back to the global constant.
    const { data: effDeadline } = await supabase.rpc("bracket_deadline");
    const lockAt = typeof effDeadline === "string" ? effDeadline : BRACKET_ENTRY_DEADLINE_ISO;
    const locked = Date.now() >= new Date(lockAt).getTime();

    const matches: BracketMatchView[] = (matchRows ?? []).map((m) => {
      const p = pickByMatch.get(m.id);
      return {
        matchId: m.id,
        matchNumber: m.match_number,
        stage: m.stage as MatchStage,
        kickoffAt: m.kickoff_at,
        homeTeamId: m.home_team_id,
        awayTeamId: m.away_team_id,
        myAdvancerTeamId: p?.advancer_team_id ?? null,
        myHomeScore: p?.home_score ?? null,
        myAwayScore: p?.away_score ?? null,
      };
    });

    return { lockAt, locked, matches };
  } catch (err) {
    console.error("Error in getBracket:", err);
    return empty;
  }
}

/**
 * Post-deadline bracket comparison, scoped to the viewer's OWN leagues only
 * (the deduped member union across the live leagues they belong to — never the
 * whole pool). Returns every league-mate's advancer picks (incl. the viewer),
 * the real advancers so far, eliminated teams, and each peer's advancement
 * points / correct / still-alive counts, ranked. Empty until the deadline
 * passes (brackets stay private until then, enforced by RLS too).
 */
export async function getLeagueBrackets(): Promise<BracketComparison> {
  const empty: BracketComparison = { available: false, actualAdvancers: {}, eliminatedTeamIds: [], peers: [] };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return empty;

    // Only reveal once the bracket deadline has passed (RLS enforces the same).
    if (Date.now() < new Date(BRACKET_ENTRY_DEADLINE_ISO).getTime()) {
      return empty;
    }

    // League-union scope (live leagues only), identical to the pick strips.
    const { data: myLeagues } = await supabase
      .from("league_members").select("league_id").eq("user_id", user.id);
    const candidateLeagueIds = (myLeagues ?? []).map((r) => r.league_id);
    if (candidateLeagueIds.length === 0) return empty;
    const { data: liveLeagues } = await supabase
      .from("leagues").select("id").in("id", candidateLeagueIds);
    const leagueIds = (liveLeagues ?? []).map((l) => l.id);
    if (leagueIds.length === 0) return empty;
    const { data: memberRows } = await supabase
      .from("league_members").select("user_id").in("league_id", leagueIds);
    const memberIds = Array.from(new Set((memberRows ?? []).map((r) => r.user_id)));
    if (memberIds.length === 0) return empty;

    const { data: userRows } = await supabase
      .from("users").select("id, display_name").in("id", memberIds);
    const nameById = new Map((userRows ?? []).map((u) => [u.id, u.display_name as string]));

    // KO matches: number + real participants (home/away once assigned).
    const { data: koMatches } = await supabase
      .from("matches")
      .select("id, match_number, home_team_id, away_team_id")
      .neq("stage", "group");
    const numById = new Map((koMatches ?? []).map((m) => [m.id, m.match_number as number]));
    const participants = new Map<number, Array<string>>();
    for (const m of koMatches ?? []) {
      participants.set(m.match_number, [m.home_team_id, m.away_team_id].filter(Boolean) as string[]);
    }

    // Real advancers so far → actualAdvancers + the (weight:team) "earned" set.
    const { data: results } = await supabase
      .from("match_results").select("match_id, advanced_team_id");
    const actualAdvancers: Record<number, string> = {};
    const realEarned = new Set<string>();
    const eliminated = new Set<string>();
    for (const r of results ?? []) {
      const mn = numById.get(r.match_id);
      if (mn == null || !r.advanced_team_id) continue;
      actualAdvancers[mn] = r.advanced_team_id as string;
      const w = ADVANCEMENT_POINTS_BY_MATCH[mn];
      if (w) realEarned.add(`${w}:${r.advanced_team_id}`);
      for (const p of participants.get(mn) ?? []) {
        if (p !== r.advanced_team_id) eliminated.add(p);
      }
    }

    // Every member's advancer picks (paginated — members × KO matches can pass 1000).
    const advByUser = new Map<string, Record<number, string | null>>();
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("bracket_picks")
        .select("user_id, match_id, advancer_team_id")
        .in("user_id", memberIds)
        .order("user_id", { ascending: true })
        .order("match_id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      for (const row of data) {
        const mn = numById.get(row.match_id);
        if (mn == null) continue;
        const map = advByUser.get(row.user_id) ?? {};
        map[mn] = (row.advancer_team_id as string | null) ?? null;
        advByUser.set(row.user_id, map);
      }
      if (data.length < PAGE) break;
    }

    const peers: BracketPeer[] = memberIds.map((uid) => {
      const advancers = advByUser.get(uid) ?? {};
      let points = 0, correctPicks = 0, alivePicks = 0;
      const counted = new Set<string>(); // dedup (weight:team) for set-based points
      for (const [mnStr, team] of Object.entries(advancers)) {
        if (!team) continue;
        const mn = Number(mnStr);
        const w = ADVANCEMENT_POINTS_BY_MATCH[mn];
        const earned = !!w && realEarned.has(`${w}:${team}`);
        if (earned) {
          correctPicks++;
          const key = `${w}:${team}`;
          if (!counted.has(key)) { counted.add(key); points += w; }
        } else if (actualAdvancers[mn] === undefined && !eliminated.has(team)) {
          alivePicks++; // game not played yet and the pick's team is still in
        }
      }
      return {
        userId: uid,
        displayName: nameById.get(uid) ?? "—",
        isMe: uid === user.id,
        advancers,
        points,
        correctPicks,
        alivePicks,
      };
    });

    peers.sort((a, b) =>
      b.points - a.points ||
      b.correctPicks - a.correctPicks ||
      b.alivePicks - a.alivePicks ||
      a.displayName.localeCompare(b.displayName)
    );

    return { available: true, actualAdvancers, eliminatedTeamIds: Array.from(eliminated), peers };
  } catch (err) {
    console.error("Error in getLeagueBrackets:", err);
    return empty;
  }
}

/**
 * Unified leaderboard for ONE league, ranked by grand total (then knockout-
 * stage points). Returns every member with the full point breakdown (group /
 * knockout scorelines, bracket advancement, bonus picks), their predicted
 * champion (for the flag) and whether that team is out, plus the viewer's live
 * leagues for the filter. Scoped to a league the viewer actually belongs to.
 */
export async function getLeaderboard(leagueId?: string): Promise<LeaderboardData> {
  const empty: LeaderboardData = { myUserId: null, leagues: [], leagueId: null, leagueName: null, entries: [] };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return empty;

    // The viewer's live leagues (for the filter).
    const { data: myMemberships } = await supabase
      .from("league_members").select("league_id").eq("user_id", user.id);
    const myLeagueIds = (myMemberships ?? []).map((r) => r.league_id);
    if (myLeagueIds.length === 0) return { ...empty, myUserId: user.id };
    const { data: leagueRows } = await supabase
      .from("leagues").select("id, name").in("id", myLeagueIds).order("name", { ascending: true });
    const leagues = (leagueRows ?? []).map((l) => ({ id: l.id as string, name: l.name as string }));
    if (leagues.length === 0) return { ...empty, myUserId: user.id };

    // Pick the requested league only if the viewer is in it; else the first.
    const selected = leagues.find((l) => l.id === leagueId) ?? leagues[0];

    // Members of the selected league + their names.
    const { data: memberRows } = await supabase
      .from("league_members").select("user_id").eq("league_id", selected.id);
    const memberIds = Array.from(new Set((memberRows ?? []).map((r) => r.user_id)));
    if (memberIds.length === 0) {
      return { myUserId: user.id, leagues, leagueId: selected.id, leagueName: selected.name, entries: [] };
    }
    const { data: userRows } = await supabase
      .from("users").select("id, display_name").in("id", memberIds);
    const nameById = new Map((userRows ?? []).map((u) => [u.id, u.display_name as string]));

    // Scores (members with no activity won't appear in the view → default 0s).
    const { data: scoreRows } = await supabase
      .from("leaderboard_view")
      .select("user_id, total_points, group_score_points, ko_score_points, bracket_points, bonus_pick_points, knockout_points, first_prediction_at")
      .in("user_id", memberIds);
    const scoreById = new Map((scoreRows ?? []).map((s) => [s.user_id as string, s]));

    // Each member's predicted champion (+ team info for the flag).
    const { data: bonusRows } = await supabase
      .from("bonus_predictions").select("user_id, champion_team_id").in("user_id", memberIds);
    const championByUser = new Map(
      (bonusRows ?? []).filter((b) => b.champion_team_id).map((b) => [b.user_id as string, b.champion_team_id as string])
    );
    const { data: teamRows } = await supabase
      .from("teams").select("id, code, name_es, name_en, flag_emoji");
    const teamById = new Map((teamRows ?? []).map((t) => [t.id as string, t]));

    // Which teams are already knocked out (lost a played KO match).
    const { data: koMatches } = await supabase
      .from("matches").select("id, home_team_id, away_team_id").neq("stage", "group");
    const participantsByMatch = new Map(
      (koMatches ?? []).map((m) => [m.id as string, [m.home_team_id, m.away_team_id].filter(Boolean) as string[]])
    );
    const { data: results } = await supabase
      .from("match_results").select("match_id, advanced_team_id");
    const eliminated = new Set<string>();
    for (const r of results ?? []) {
      if (!r.advanced_team_id) continue;
      for (const p of participantsByMatch.get(r.match_id as string) ?? []) {
        if (p !== r.advanced_team_id) eliminated.add(p);
      }
    }

    const entries: UnifiedLeaderboardEntry[] = memberIds.map((uid) => {
      const s = scoreById.get(uid);
      const championTeamId = championByUser.get(uid) ?? null;
      const team = championTeamId ? teamById.get(championTeamId) : null;
      return {
        userId: uid,
        displayName: nameById.get(uid) ?? "—",
        isMe: uid === user.id,
        rank: 0,
        total: (s?.total_points as number) ?? 0,
        groupScore: (s?.group_score_points as number) ?? 0,
        koScore: (s?.ko_score_points as number) ?? 0,
        bracket: (s?.bracket_points as number) ?? 0,
        bonus: (s?.bonus_pick_points as number) ?? 0,
        koTiebreak: (s?.knockout_points as number) ?? 0,
        movement: null,
        championTeamId,
        championCode: (team?.code as string) ?? null,
        championNameEs: (team?.name_es as string) ?? null,
        championNameEn: (team?.name_en as string) ?? null,
        championFlagEmoji: (team?.flag_emoji as string) ?? null,
        championEliminated: !!championTeamId && eliminated.has(championTeamId),
      };
    });

    // Rank: total desc, then knockout-stage points desc (the official tiebreak),
    // then name for stability.
    entries.sort((a, b) =>
      b.total - a.total ||
      b.koTiebreak - a.koTiebreak ||
      a.displayName.localeCompare(b.displayName)
    );
    entries.forEach((e, i) => { e.rank = i + 1; });

    // Rank-movement since the start of the most recent day that had results.
    // "As of" totals come from leaderboard_total_as_of(cutoff) so they're
    // consistent with the grand-total ranking. Competition ranking (ties share
    // a rank) on total only, both snapshots, so ties never produce phantom arrows.
    try {
      const { data: latest } = await supabase
        .from("match_results").select("recorded_at").order("recorded_at", { ascending: false }).limit(1);
      const latestIso = latest?.[0]?.recorded_at as string | undefined;
      if (latestIso) {
        // Start of that result's day in US Eastern (EDT = UTC-4 for the whole WC).
        const et = new Date(new Date(latestIso).getTime() - 4 * 3600_000);
        const cutoffIso = new Date(Date.UTC(et.getUTCFullYear(), et.getUTCMonth(), et.getUTCDate(), 4, 0, 0)).toISOString();
        const { data: asOf } = await supabase.rpc("leaderboard_total_as_of", { cutoff: cutoffIso });
        const memberSet = new Set(memberIds);
        const asOfTotal = new Map<string, number>(memberIds.map((id) => [id, 0]));
        for (const r of (asOf ?? []) as Array<{ user_id: string; total_points: number }>) {
          if (memberSet.has(r.user_id)) asOfTotal.set(r.user_id, r.total_points ?? 0);
        }
        const rankByTotal = (totalOf: (id: string) => number) => {
          const ranks = new Map<string, number>();
          for (const id of memberIds) {
            const t = totalOf(id);
            ranks.set(id, 1 + memberIds.filter((o) => totalOf(o) > t).length);
          }
          return ranks;
        };
        const nowRanks = rankByTotal((id) => entries.find((e) => e.userId === id)!.total);
        const wasRanks = rankByTotal((id) => asOfTotal.get(id) ?? 0);
        for (const e of entries) {
          const was = wasRanks.get(e.userId), now = nowRanks.get(e.userId);
          e.movement = was != null && now != null ? was - now : null;
        }
      }
    } catch (mErr) {
      console.error("movement calc:", mErr); // arrows are best-effort; never block the board
    }

    return { myUserId: user.id, leagues, leagueId: selected.id, leagueName: selected.name, entries };
  } catch (err) {
    console.error("Error in getLeaderboard:", err);
    return empty;
  }
}

/**
 * Statistics for one league: the title-race (Vegas odds snapshot + this
 * league's champion-pick consensus), the Golden Boot race (live scorer snapshot
 * merged with who picked them), and the Golden Ball pick consensus. Works off
 * our own pick data; the scorers/odds snapshot is an optional overlay.
 */
export async function getStats(leagueId?: string, locale: Locale = "es"): Promise<StatsData> {
  const es = locale === "es";
  const empty: StatsData = { leagues: [], leagueId: null, leagueName: null, memberCount: 0, titleRace: [], goldenBoot: [], goldenBall: [], snapshotLoaded: false };
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return empty;

    const { data: myMemberships } = await supabase
      .from("league_members").select("league_id").eq("user_id", user.id);
    const myLeagueIds = (myMemberships ?? []).map((r) => r.league_id);
    if (myLeagueIds.length === 0) return empty;
    const { data: leagueRows } = await supabase
      .from("leagues").select("id, name").in("id", myLeagueIds).order("name", { ascending: true });
    const leagues = (leagueRows ?? []).map((l) => ({ id: l.id as string, name: l.name as string }));
    if (leagues.length === 0) return empty;
    const selected = leagues.find((l) => l.id === leagueId) ?? leagues[0];

    const { data: memberRows } = await supabase
      .from("league_members").select("user_id").eq("league_id", selected.id);
    const memberIds = Array.from(new Set((memberRows ?? []).map((r) => r.user_id)));
    const memberCount = memberIds.length;
    if (memberCount === 0) {
      return { ...empty, leagues, leagueId: selected.id, leagueName: selected.name };
    }
    const { data: userRows } = await supabase.from("users").select("id, display_name").in("id", memberIds);
    const nameById = new Map((userRows ?? []).map((u) => [u.id, u.display_name as string]));

    const { data: bonus } = await supabase
      .from("bonus_predictions")
      .select("user_id, champion_team_id, top_scorer_name, best_player_name")
      .in("user_id", memberIds);

    const { data: teamRows } = await supabase.from("teams").select("id, code, name_es, name_en, flag_emoji");
    const teamById = new Map((teamRows ?? []).map((t) => [t.id as string, t]));
    const teamByCode = new Map((teamRows ?? []).map((t) => [t.code as string, t]));

    // Eliminated teams (lost a played KO match) → for the champion flag.
    const { data: koMatches } = await supabase
      .from("matches").select("id, home_team_id, away_team_id").neq("stage", "group");
    const partsByMatch = new Map((koMatches ?? []).map((m) => [m.id as string, [m.home_team_id, m.away_team_id].filter(Boolean) as string[]]));
    const { data: results } = await supabase.from("match_results").select("match_id, advanced_team_id");
    const eliminated = new Set<string>();
    for (const r of results ?? []) {
      if (!r.advanced_team_id) continue;
      for (const p of partsByMatch.get(r.match_id as string) ?? []) if (p !== r.advanced_team_id) eliminated.add(p);
    }

    // Snapshot overlay.
    const { data: oddsRows } = await supabase.from("stat_title_odds").select("rank, team_code, odds, implied_pct").order("rank");
    const { data: bootRows } = await supabase.from("stat_golden_boot").select("rank, player_name, team_code, goals, photo_url").order("rank");
    const snapshotLoaded = (oddsRows?.length ?? 0) > 0 || (bootRows?.length ?? 0) > 0;

    // ---- Title race: champion-pick consensus ∪ Vegas odds, keyed by team code ----
    const champCount = new Map<string, { count: number; pickedBy: string[] }>(); // teamCode -> tally
    for (const b of bonus ?? []) {
      if (!b.champion_team_id) continue;
      const t = teamById.get(b.champion_team_id as string);
      if (!t) continue;
      const code = t.code as string;
      const cur = champCount.get(code) ?? { count: 0, pickedBy: [] };
      cur.count++; cur.pickedBy.push(nameById.get(b.user_id as string) ?? "—");
      champCount.set(code, cur);
    }
    const oddsByCode = new Map((oddsRows ?? []).map((o) => [o.team_code as string, o]));
    const titleCodes = new Set<string>([...champCount.keys(), ...oddsByCode.keys()]);
    const titleRace: TitleRaceRow[] = Array.from(titleCodes).map((code) => {
      const t = teamByCode.get(code);
      const ch = champCount.get(code) ?? { count: 0, pickedBy: [] };
      const o = oddsByCode.get(code);
      return {
        teamCode: code,
        teamName: t ? ((es ? t.name_es : t.name_en) as string) : code,
        flagEmoji: (t?.flag_emoji as string) ?? null,
        eliminated: !!t && eliminated.has(t.id as string),
        vegasOdds: (o?.odds as string) ?? null,
        vegasImpliedPct: (o?.implied_pct as number) ?? null,
        leagueCount: ch.count,
        leaguePct: Math.round((ch.count / memberCount) * 100),
        pickedBy: ch.pickedBy,
      };
    });
    titleRace.sort((a, b) =>
      (a.vegasImpliedPct == null ? 1 : 0) - (b.vegasImpliedPct == null ? 1 : 0) ||
      (b.vegasImpliedPct ?? 0) - (a.vegasImpliedPct ?? 0) ||
      b.leagueCount - a.leagueCount ||
      a.teamName.localeCompare(b.teamName)
    );

    // ---- Golden Boot: scorer snapshot ∪ league boot picks, matched by name ----
    const bootPick = new Map<string, { label: string; count: number; pickedBy: string[] }>();
    for (const b of bonus ?? []) {
      const raw = (b.top_scorer_name as string | null)?.trim();
      if (!raw) continue;
      const k = norm(raw);
      const cur = bootPick.get(k) ?? { label: raw, count: 0, pickedBy: [] };
      cur.count++; cur.pickedBy.push(nameById.get(b.user_id as string) ?? "—");
      bootPick.set(k, cur);
    }
    const goldenBoot: BootRaceRow[] = [];
    const usedBootKeys = new Set<string>();
    for (const r of bootRows ?? []) {
      const k = norm(r.player_name as string);
      usedBootKeys.add(k);
      const pick = bootPick.get(k);
      const t = r.team_code ? teamByCode.get(r.team_code as string) : null;
      goldenBoot.push({
        rank: (r.rank as number) ?? null,
        playerName: r.player_name as string,
        teamCode: (r.team_code as string) ?? null,
        flagEmoji: (t?.flag_emoji as string) ?? null,
        goals: (r.goals as number) ?? null,
        photoUrl: (r.photo_url as string) ?? null,
        leagueCount: pick?.count ?? 0,
        leaguePct: pick ? Math.round((pick.count / memberCount) * 100) : 0,
        pickedBy: pick?.pickedBy ?? [],
      });
    }
    // League picks not on the snapshot board (or no snapshot at all) → list them too.
    for (const [k, pick] of bootPick) {
      if (usedBootKeys.has(k)) continue;
      goldenBoot.push({
        rank: null, playerName: pick.label, teamCode: null, flagEmoji: null,
        goals: null, photoUrl: null,
        leagueCount: pick.count, leaguePct: Math.round((pick.count / memberCount) * 100), pickedBy: pick.pickedBy,
      });
    }
    goldenBoot.sort((a, b) =>
      (a.rank == null ? 1 : 0) - (b.rank == null ? 1 : 0) ||
      (a.rank ?? 0) - (b.rank ?? 0) ||
      b.leagueCount - a.leagueCount ||
      a.playerName.localeCompare(b.playerName)
    );

    // ---- Golden Ball: pick consensus ----
    const ballPick = new Map<string, { label: string; count: number; pickedBy: string[] }>();
    for (const b of bonus ?? []) {
      const raw = (b.best_player_name as string | null)?.trim();
      if (!raw) continue;
      const k = norm(raw);
      const cur = ballPick.get(k) ?? { label: raw, count: 0, pickedBy: [] };
      cur.count++; cur.pickedBy.push(nameById.get(b.user_id as string) ?? "—");
      ballPick.set(k, cur);
    }
    const goldenBall: PickShare[] = Array.from(ballPick.values())
      .map((p) => ({ label: p.label, count: p.count, pct: Math.round((p.count / memberCount) * 100), pickedBy: p.pickedBy }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    return { leagues, leagueId: selected.id, leagueName: selected.name, memberCount, titleRace, goldenBoot, goldenBall, snapshotLoaded };
  } catch (err) {
    console.error("Error in getStats:", err);
    return empty;
  }
}

/**
 * Save the viewer's bracket. RLS enforces the one-window lock (writes only
 * before the first R32 kickoff, knockout matches only). advancerTeamId is
 * who they advance from each match; scores are optional precision picks.
 */
export async function submitBracket(input: {
  picks: Array<{ matchId: string; advancerTeamId: string | null; homeScore: number | null; awayScore: number | null }>;
}): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "No autenticado / Not authenticated" };

    const hasProfile = await checkUserProfile(supabase, user.id);
    if (!hasProfile) {
      return { ok: false, error: "Completa tu perfil primero / Complete onboarding first" };
    }

    for (const p of input.picks) {
      const okScore = (v: number | null) => v === null || (Number.isInteger(v) && v >= 0 && v <= 30);
      if (!okScore(p.homeScore) || !okScore(p.awayScore)) {
        return { ok: false, error: "Marcador inválido / Invalid score (0-30)" };
      }
    }

    // Per-match lock: only persist picks for knockout games still open
    // (now < min(entry deadline, kickoff - 15m)). Locked games (e.g. match 73
    // once it nears kickoff) are skipped so one closed game can't fail the
    // whole save — RLS enforces the same rule as a backstop.
    const ids = input.picks.map((p) => p.matchId);
    const { data: kmatches } = await supabase
      .from("matches")
      .select("id, kickoff_at, stage, is_voided")
      .in("id", ids);
    // Effective per-user deadline (honors admin grace); RLS is the real backstop.
    const { data: effDeadline } = await supabase.rpc("bracket_deadline");
    const deadlineMs = new Date(
      typeof effDeadline === "string" ? effDeadline : BRACKET_ENTRY_DEADLINE_ISO
    ).getTime();
    const nowMs = Date.now();
    const openIds = new Set(
      (kmatches ?? [])
        .filter(
          (m) =>
            m.stage !== "group" &&
            !m.is_voided &&
            nowMs < Math.min(deadlineMs, new Date(m.kickoff_at).getTime() - LOCK_BEFORE_KICKOFF_MS)
        )
        .map((m) => m.id)
    );

    const rows = input.picks
      .filter((p) => openIds.has(p.matchId))
      .map((p) => ({
        user_id: user.id,
        match_id: p.matchId,
        advancer_team_id: p.advancerTeamId,
        home_score: p.homeScore,
        away_score: p.awayScore,
        updated_at: new Date().toISOString(),
      }));

    if (rows.length > 0) {
      const { error } = await supabase.from("bracket_picks").upsert(rows);
      if (error) {
        const locked = error.message.toLowerCase().includes("policy");
        return {
          ok: false,
          error: locked
            ? "La llave ya está cerrada / The bracket is locked"
            : error.message,
        };
      }
    }
    return { ok: true, data: undefined };
  } catch (err: any) {
    return { ok: false, error: err.message || "Error al guardar la llave / Error saving bracket" };
  }
}

export async function getBonuses(): Promise<BonusView> {
  let lockAt = TOURNAMENT_START_ISO;
  let locked = new Date() >= new Date(lockAt);

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

    // Owner-granted re-open window: while it lasts, the form unlocks
    // and the countdown points at the personal deadline instead.
    const { data: profile } = await supabase
      .from("users")
      .select("bonus_unlock_until")
      .eq("id", user.id)
      .maybeSingle();
    if (
      profile?.bonus_unlock_until &&
      new Date(profile.bonus_unlock_until) > new Date()
    ) {
      lockAt = profile.bonus_unlock_until;
      locked = false;
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
        nameChangeUsed: false,
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

    if (
      match.is_voided ||
      !match.home_team_id ||
      !match.away_team_id ||
      Date.now() >= new Date(match.kickoff_at).getTime() - LOCK_BEFORE_KICKOFF_MS
    ) {
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

    // Locked since tournament start unless the owner granted this user
    // a personal re-open window (users.bonus_unlock_until, RLS-mirrored).
    const { data: profile } = await supabase
      .from("users")
      .select("bonus_unlock_until")
      .eq("id", user.id)
      .maybeSingle();
    const unlockActive =
      !!profile?.bonus_unlock_until &&
      new Date(profile.bonus_unlock_until) > new Date();
    if (new Date() >= new Date(TOURNAMENT_START_ISO) && !unlockActive) {
      return { ok: false, error: "Los bonos ya están bloqueados / Bonuses are already locked" };
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

// ==========================================
// LEAGUE ADMINISTRATION
// ==========================================

async function requireLeagueAdmin(
  supabase: any,
  leagueId: string
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado / Not authenticated" };

  const { data: league } = await supabase
    .from("leagues")
    .select("admin_user_id")
    .eq("id", leagueId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!league) return { ok: false, error: "Liga no encontrada / League not found" };

  if (league.admin_user_id !== user.id) {
    const { data: profile } = await supabase
      .from("users")
      .select("is_superadmin")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.is_superadmin) {
      return { ok: false, error: "Solo el admin de la liga puede hacer esto / League admin only" };
    }
  }
  return { ok: true, userId: user.id };
}

export async function renameLeague(
  input: { leagueId: string; name: string }
): Promise<ActionResult> {
  const nameValidation = leagueNameSchema.safeParse(input.name);
  if (!nameValidation.success) {
    return {
      ok: false,
      error: nameValidation.error.issues[0]?.message || "Nombre de liga inválido / Invalid league name",
    };
  }
  try {
    const supabase = await createClient();
    const auth = await requireLeagueAdmin(supabase, input.leagueId);
    if (!auth.ok) return auth;

    const { error } = await supabase
      .from("leagues")
      .update({ name: nameValidation.data })
      .eq("id", input.leagueId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  } catch (err: any) {
    return { ok: false, error: err.message || "Error al renombrar / Error renaming" };
  }
}

export async function regenerateLeagueCode(
  input: { leagueId: string }
): Promise<ActionResult<{ inviteCode: string }>> {
  try {
    const supabase = await createClient();
    const auth = await requireLeagueAdmin(supabase, input.leagueId);
    if (!auth.ok) return auth;

    let lastError: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const inviteCode = generateInviteCode();
      const { error } = await supabase
        .from("leagues")
        .update({ invite_code: inviteCode })
        .eq("id", input.leagueId);
      if (!error) return { ok: true, data: { inviteCode } };
      lastError = error;
      if (error.code !== "23505") break;
    }
    return { ok: false, error: lastError?.message || "Error al regenerar código / Error regenerating code" };
  } catch (err: any) {
    return { ok: false, error: err.message || "Error al regenerar código / Error regenerating code" };
  }
}

export async function deleteLeague(
  input: { leagueId: string }
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const auth = await requireLeagueAdmin(supabase, input.leagueId);
    if (!auth.ok) return auth;

    // Soft delete via SECURITY DEFINER RPC: a plain UPDATE is rejected by
    // RLS because the new row (deleted_at set) escapes the SELECT policy.
    const { data: deleted, error } = await supabase.rpc("soft_delete_league", {
      p_league_id: input.leagueId,
    });
    if (error) return { ok: false, error: error.message };
    if (!deleted) {
      return { ok: false, error: "No se pudo eliminar la liga / Could not delete league" };
    }
    return { ok: true, data: undefined };
  } catch (err: any) {
    return { ok: false, error: err.message || "Error al eliminar liga / Error deleting league" };
  }
}

export async function kickMember(
  input: { leagueId: string; userId: string }
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const auth = await requireLeagueAdmin(supabase, input.leagueId);
    if (!auth.ok) return auth;

    if (input.userId === auth.userId) {
      return { ok: false, error: "El admin no puede expulsarse a sí mismo / Admin cannot remove themselves" };
    }

    const { error } = await supabase
      .from("league_members")
      .delete()
      .eq("league_id", input.leagueId)
      .eq("user_id", input.userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  } catch (err: any) {
    return { ok: false, error: err.message || "Error al expulsar / Error removing member" };
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
      .select("id, kickoff_at, is_voided, stage, home_team_id, away_team_id")
      .in("id", ids);

    const now = Date.now();
    const openIds = new Set(
      (matches ?? [])
        .filter(
          (m) =>
            !m.is_voided &&
            m.home_team_id &&
            m.away_team_id &&
            now < new Date(m.kickoff_at).getTime() - LOCK_BEFORE_KICKOFF_MS
        )
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

