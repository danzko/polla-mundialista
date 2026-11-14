import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTournament } from "@/lib/api";
import { LOCK_BEFORE_KICKOFF_MS } from "@/lib/tournament";
import type { ReminderStatus } from "@/lib/types";

/** Superadmin-only snapshot of who still has picks to make. Not a server action: only pages import it. */
export async function getReminderStatus(): Promise<ReminderStatus | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: me } = await sb.from("users").select("is_superadmin").eq("id", user.id).maybeSingle();
  if (!me?.is_superadmin) return null;

  const t = await getCurrentTournament();
  const db = createAdminClient();
  const { data: tm } = await db.from("tournaments").select("kind, name_es, picks_lock_at").eq("id", t.id).single();

  const { data: future } = await db
    .from("matches").select("id, matchday, stage, leg, kickoff_at")
    .eq("tournament_id", t.id).eq("is_voided", false)
    .not("home_team_id", "is", null).not("away_team_id", "is", null)
    .gt("kickoff_at", new Date(Date.now() + LOCK_BEFORE_KICKOFF_MS).toISOString())
    .order("kickoff_at", { ascending: true });
  const first = future?.[0];
  const games = first
    ? (future ?? []).filter((m) => (first.matchday != null ? m.matchday === first.matchday : m.stage === first.stage && m.leg === first.leg))
    : [];

  const { data: lm } = await db.from("league_members").select("user_id");
  const ids = Array.from(new Set((lm ?? []).map((r) => r.user_id as string)));
  if (ids.length === 0) return null;
  const [{ data: profiles }, { data: board }, { data: bonus }, { data: top8 }, { data: picks }] = await Promise.all([
    db.from("users").select("id, display_name, email_reminders").in("id", ids),
    db.from("leaderboard_view").select("user_id").eq("tournament_id", t.id).gt("total_points", 0).in("user_id", ids),
    db.from("bonus_predictions").select("user_id, champion_team_id").eq("tournament_id", t.id).in("user_id", ids),
    db.from("top8_picks").select("user_id").eq("tournament_id", t.id).in("user_id", ids),
    games.length
      ? db.from("predictions").select("user_id").in("match_id", games.map((g) => g.id as string)).in("user_id", ids).limit(10000)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
  ]);
  const count = new Map<string, number>();
  for (const p of picks ?? []) count.set(p.user_id as string, (count.get(p.user_id as string) ?? 0) + 1);
  const onBoard = new Set((board ?? []).map((r) => r.user_id as string));
  const champ = new Set((bonus ?? []).filter((b) => b.champion_team_id).map((b) => b.user_id as string));
  const t8 = new Set((top8 ?? []).map((r) => r.user_id as string));

  return {
    tournamentName: tm?.name_es ?? t.slug,
    isUcl: tm?.kind === "ucl",
    round: first
      ? { label: first.matchday != null ? `Jornada ${first.matchday}` : "la próxima ronda", firstKickoff: first.kickoff_at as string, openGames: games.length }
      : null,
    lockAt: (tm?.picks_lock_at as string | null) ?? null,
    emailReady: !!(process.env.CRON_SECRET && (process.env.BREVO_API_KEY || process.env.RESEND_API_KEY) && (process.env.EMAIL_FROM || process.env.RESEND_FROM)),
    members: (profiles ?? []).map((p) => ({
      userId: p.id as string, name: p.display_name as string,
      picks: count.get(p.id as string) ?? 0,
      hasChampion: champ.has(p.id as string), hasTop8: t8.has(p.id as string),
      onBoard: onBoard.has(p.id as string), emailsOn: p.email_reminders !== false,
    })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}
