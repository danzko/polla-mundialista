import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Matchday reminder (Vercel cron, daily 13:00 UTC = 9am ET). For every
 * non-archived tournament, finds the games kicking off 12–36 h from now and
 * emails each league member who still has picks missing for them — one email
 * per matchday, the day before. Sends through Resend's REST API.
 *
 * No-ops (200) unless RESEND_API_KEY + RESEND_FROM are set. Protected by
 * CRON_SECRET (Vercel sends it as a bearer token).
 */
export const dynamic = "force-dynamic";

const H = 3_600_000;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) return NextResponse.json({ ok: true, skipped: "RESEND_API_KEY / RESEND_FROM not set" });

  const supabase = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://polla-mundialista-puce.vercel.app";
  const now = Date.now();
  const fromIso = new Date(now + 12 * H).toISOString();
  const toIso = new Date(now + 36 * H).toISOString();

  const { data: tournaments } = await supabase
    .from("tournaments").select("id, slug, name_es, name_en").neq("status", "archived");
  const report: Record<string, unknown> = {};

  for (const t of tournaments ?? []) {
    const { data: games } = await supabase
      .from("matches")
      .select("id, matchday, stage, kickoff_at")
      .eq("tournament_id", t.id).eq("is_voided", false)
      .not("home_team_id", "is", null).not("away_team_id", "is", null)
      .gte("kickoff_at", fromIso).lte("kickoff_at", toIso);
    if (!games || games.length === 0) { report[t.slug] = "no games in window"; continue; }
    const gameIds = games.map((g) => g.id as string);

    // Everyone in a league, with their language; emails from the Auth admin API.
    const { data: members } = await supabase.from("league_members").select("user_id");
    const userIds = Array.from(new Set((members ?? []).map((m) => m.user_id as string)));
    const { data: profiles } = await supabase.from("users").select("id, display_name, preferred_language").in("id", userIds);
    const { data: preds } = await supabase.from("predictions").select("user_id, match_id").in("match_id", gameIds).in("user_id", userIds);
    const pickedBy = new Map<string, Set<string>>();
    for (const p of preds ?? []) {
      const s = pickedBy.get(p.user_id as string) ?? new Set<string>();
      s.add(p.match_id as string); pickedBy.set(p.user_id as string, s);
    }

    const emailById = new Map<string, string>();
    for (let page = 1; page <= 10; page++) {
      const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      for (const u of data?.users ?? []) if (u.email) emailById.set(u.id, u.email);
      if (!data || data.users.length < 200) break;
    }

    const md = games[0].matchday as number | null;
    const first = new Date(Math.min(...games.map((g) => new Date(g.kickoff_at as string).getTime())));
    let sent = 0; const errors: string[] = [];
    for (const u of profiles ?? []) {
      const email = emailById.get(u.id as string);
      if (!email) continue;
      const missing = gameIds.length - (pickedBy.get(u.id as string)?.size ?? 0);
      if (missing <= 0) continue;
      const es = (u.preferred_language ?? "es") === "es";
      const when = first.toLocaleString(es ? "es-CO" : "en-US", { timeZone: "America/New_York", weekday: "long", hour: "numeric", minute: "2-digit" });
      const round = md != null ? (es ? `Jornada ${md}` : `Matchday ${md}`) : (es ? "la próxima ronda" : "the next round");
      const name = es ? t.name_es : t.name_en;
      const subject = es ? `⚽ ${round}: te faltan ${missing} pronósticos` : `⚽ ${round}: ${missing} picks still missing`;
      const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#EAF1F9;background:#0F1523;border-radius:16px">
          <div style="font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#F4D488">${name}</div>
          <h1 style="margin:8px 0 4px;font-size:22px">${es ? `Hola ${u.display_name},` : `Hi ${u.display_name},`}</h1>
          <p style="margin:0 0 16px;color:#8393AB;font-size:14px;line-height:1.5">
            ${es
              ? `${round} arranca <b style="color:#EAF1F9">${when} ET</b> y todavía te faltan <b style="color:#F2C452">${missing}</b> de ${gameIds.length} pronósticos. Cada partido se cierra 15 minutos antes del pitazo.`
              : `${round} kicks off <b style="color:#EAF1F9">${when} ET</b> and you still have <b style="color:#F2C452">${missing}</b> of ${gameIds.length} picks missing. Each game locks 15 minutes before kickoff.`}
          </p>
          <a href="${appUrl}/${es ? "es" : "en"}/matches" style="display:inline-block;background:#F2C452;color:#1a1200;font-weight:800;padding:12px 20px;border-radius:12px;text-decoration:none">
            ${es ? "Hacer mis pronósticos →" : "Make my picks →"}
          </a>
          <p style="margin:20px 0 0;font-size:11px;color:#54617A">La Polla · ${es ? "un correo por jornada, el día anterior" : "one email per matchday, the day before"}</p>
        </div>`;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [email], subject, html }),
      });
      if (res.ok) sent++; else errors.push(`${email}: ${res.status}`);
    }
    report[t.slug] = { games: gameIds.length, sent, errors: errors.slice(0, 5) };
  }

  return NextResponse.json({ ok: true, window: [fromIso, toIso], report });
}
