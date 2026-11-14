import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signUnsub } from "@/lib/reminder-token";
import { LOCK_BEFORE_KICKOFF_MS } from "@/lib/tournament";

/**
 * Reminder emails (Vercel cron, daily 13:00 UTC = 9am ET). Two kinds:
 *   matchday  a round starts tomorrow and you still have scorelines missing
 *   picks     the season picks (champion / scorer / player / Top 8) lock soon
 *
 * Audience: league members who have ALREADY started playing this tournament
 * (on the board, or entered a pick). Dormant members are not emailed daily;
 * the admin panel's WhatsApp message is the nudge for them. Anyone who
 * unsubscribed (users.email_reminders = false) is skipped.
 *
 * Idempotent: reminder_log's primary key allows one email per user, tournament,
 * kind and round-day, so re-running or retrying can never double-send.
 *
 * Safety: fails closed. Without CRON_SECRET it does nothing; the secret is
 * required on every call (Vercel sends it as a bearer token). No email
 * provider configured = no sends.
 *
 * Testing: `?dry=1` lists who WOULD be emailed (names only, never addresses)
 * and sends nothing; add `&asof=<ISO time>` to simulate another day.
 */
export const dynamic = "force-dynamic";

const H = 3_600_000;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://polla-mundialista-puce.vercel.app";

type Planned = {
  kind: "matchday" | "picks";
  tournamentId: string;
  roundKey: string;
  userId: string;
  name: string;
  es: boolean;
  subject: string;
  html: string;
  detail: string;
};

function parseFrom(from: string): { name?: string; email: string } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  return m ? { name: m[1].trim() || undefined, email: m[2].trim() } : { email: from.trim() };
}

/** One send through whichever provider is configured (Brevo preferred, else Resend). */
async function sendEmail(to: string, subject: string, html: string, unsubUrl: string): Promise<boolean> {
  const from = (process.env.EMAIL_FROM ?? process.env.RESEND_FROM) as string;
  const headers = { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
  try {
    if (process.env.BREVO_API_KEY) {
      const sender = parseFrom(from);
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sender, to: [{ email: to }], subject, htmlContent: html, headers }),
      });
      return res.ok;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, headers }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function render(o: { es: boolean; name: string; tournament: string; heading: string; body: string; cta: string; href: string; unsubUrl: string }) {
  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#EAF1F9;background:#0B1240;border-radius:16px">
      <div style="font-size:12px;color:#9DB2FF">${o.tournament}</div>
      <h1 style="margin:8px 0 6px;font-size:22px">${o.heading}</h1>
      <p style="margin:0 0 18px;color:#B8C4DD;font-size:15px;line-height:1.55">${o.body}</p>
      <a href="${o.href}" style="display:inline-block;background:#5E7CFF;color:#fff;font-weight:700;padding:13px 22px;border-radius:12px;text-decoration:none">${o.cta}</a>
      <p style="margin:22px 0 0;font-size:12px;color:#7C8AAE">
        La Polla · <a href="${o.unsubUrl}" style="color:#9DB2FF">${o.es ? "No quiero más recordatorios" : "Stop these reminders"}</a>
      </p>
    </div>`;
}

const etDay = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const fmtWhen = (iso: string, es: boolean) =>
  new Date(iso).toLocaleString(es ? "es-CO" : "en-US", { timeZone: "America/New_York", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: true, skipped: "CRON_SECRET not set" });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const asof = dry ? Date.parse(url.searchParams.get("asof") ?? "") : NaN;
  const nowMs = Number.isFinite(asof) ? asof : Date.now();
  const from = process.env.EMAIL_FROM ?? process.env.RESEND_FROM;
  const hasProvider = !!(process.env.BREVO_API_KEY || process.env.RESEND_API_KEY);
  if (!dry && (!hasProvider || !from)) return NextResponse.json({ ok: true, skipped: "no email provider configured" });

  const supabase = createAdminClient();
  const { data: tournaments } = await supabase
    .from("tournaments").select("id, slug, kind, name_es, name_en, picks_lock_at").neq("status", "archived");

  // Everyone in a league, who hasn't opted out.
  const { data: lm } = await supabase.from("league_members").select("user_id");
  const memberIds = Array.from(new Set((lm ?? []).map((r) => r.user_id as string)));
  if (memberIds.length === 0) return NextResponse.json({ ok: true, planned: 0 });
  const { data: profiles } = await supabase
    .from("users").select("id, display_name, preferred_language, email_reminders").in("id", memberIds);
  const eligible = new Map(
    (profiles ?? []).filter((p) => p.email_reminders !== false).map((p) => [p.id as string, p])
  );
  const emailById = new Map<string, string>();
  for (let page = 1; page <= 10; page++) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    for (const u of data?.users ?? []) if (u.email) emailById.set(u.id, u.email);
    if (!data || data.users.length < 200) break;
  }

  const planned: Planned[] = [];
  for (const t of tournaments ?? []) {
    const tName = (es: boolean) => (es ? t.name_es : t.name_en) as string;
    const ids = [...eligible.keys()];

    // "Started playing": on the board (points > 0), or any season pick, or any scoreline.
    const engaged = new Set<string>();
    const [{ data: board }, { data: bonus }, { data: top8 }] = await Promise.all([
      supabase.from("leaderboard_view").select("user_id").eq("tournament_id", t.id).gt("total_points", 0).in("user_id", ids),
      supabase.from("bonus_predictions").select("user_id, champion_team_id").eq("tournament_id", t.id).in("user_id", ids),
      supabase.from("top8_picks").select("user_id").eq("tournament_id", t.id).in("user_id", ids),
    ]);
    for (const r of [...(board ?? []), ...(bonus ?? []), ...(top8 ?? [])]) engaged.add(r.user_id as string);
    const PAGE = 1000; // API row cap: page, ordered so pages are stable
    for (let off = 0; ; off += PAGE) {
      const { data } = await supabase
        .from("predictions").select("user_id, match_id, matches!inner(tournament_id)")
        .eq("matches.tournament_id", t.id).in("user_id", ids)
        .order("user_id", { ascending: true }).order("match_id", { ascending: true })
        .range(off, off + PAGE - 1);
      for (const r of data ?? []) engaged.add(r.user_id as string);
      if (!data || data.length < PAGE) break;
    }

    // ── matchday: a round whose first remaining game is 12-36h away ──────────
    const { data: future } = await supabase
      .from("matches").select("id, stage, matchday, leg, kickoff_at")
      .eq("tournament_id", t.id).eq("is_voided", false)
      .not("home_team_id", "is", null).not("away_team_id", "is", null)
      .gt("kickoff_at", new Date(nowMs + LOCK_BEFORE_KICKOFF_MS).toISOString())
      .order("kickoff_at", { ascending: true });
    const rounds = new Map<string, NonNullable<typeof future>>();
    for (const m of future ?? []) {
      const k = m.matchday != null ? `md${m.matchday}` : `${m.stage}-${m.leg ?? 0}`;
      rounds.set(k, [...(rounds.get(k) ?? []), m]);
    }
    for (const [rk, games] of rounds) {
      const firstMs = new Date(games[0].kickoff_at as string).getTime();
      if (firstMs <= nowMs + 12 * H || firstMs > nowMs + 36 * H) continue;
      const gameIds = games.map((g) => g.id as string);
      const { data: picks } = await supabase
        .from("predictions").select("user_id, match_id").in("match_id", gameIds).in("user_id", ids);
      const have = new Map<string, number>();
      for (const p of picks ?? []) have.set(p.user_id as string, (have.get(p.user_id as string) ?? 0) + 1);
      const label = games[0].matchday != null ? `Jornada ${games[0].matchday}` : null;
      for (const uid of engaged) {
        const prof = eligible.get(uid);
        if (!prof) continue;
        const missing = gameIds.length - (have.get(uid) ?? 0);
        if (missing <= 0) continue;
        const es = (prof.preferred_language ?? "es") === "es";
        const round = label ? (es ? label : `Matchday ${games[0].matchday}`) : es ? "la próxima ronda" : "the next round";
        const when = fmtWhen(games[0].kickoff_at as string, es);
        const unsubUrl = `${APP_URL}/api/unsubscribe?u=${uid}&s=${signUnsub(uid, secret)}&l=${es ? "es" : "en"}`;
        planned.push({
          kind: "matchday", tournamentId: t.id, roundKey: `${rk}:${etDay(firstMs)}`, userId: uid,
          name: prof.display_name as string, es,
          subject: es ? `⚽ ${round}: te faltan ${missing} pronósticos` : `⚽ ${round}: ${missing} picks still missing`,
          detail: `${round} ${missing}/${gameIds.length} missing`,
          html: render({
            es, name: prof.display_name as string, tournament: tName(es), unsubUrl,
            heading: es ? `Hola ${prof.display_name}` : `Hi ${prof.display_name}`,
            body: es
              ? `${round} arranca <b style="color:#fff">${when} ET</b> y te faltan <b style="color:#F2C452">${missing}</b> de ${gameIds.length} pronósticos. Cada partido se cierra 15 minutos antes del pitazo.`
              : `${round} kicks off <b style="color:#fff">${when} ET</b> and you still have <b style="color:#F2C452">${missing}</b> of ${gameIds.length} picks missing. Each game locks 15 minutes before kickoff.`,
            cta: es ? "Hacer mis pronósticos" : "Make my picks",
            href: `${APP_URL}/${es ? "es" : "en"}/matches`,
          }),
        });
      }
    }

    // ── picks: season picks lock 12-60h from now ─────────────────────────────
    const lockMs = t.picks_lock_at ? new Date(t.picks_lock_at as string).getTime() : null;
    if (lockMs && lockMs > nowMs + 12 * H && lockMs <= nowMs + 60 * H) {
      const hasChampion = new Set((bonus ?? []).filter((b) => b.champion_team_id).map((b) => b.user_id as string));
      const hasTop8 = new Set((top8 ?? []).map((r) => r.user_id as string));
      for (const uid of engaged) {
        const prof = eligible.get(uid);
        if (!prof) continue;
        const needsBonus = !hasChampion.has(uid);
        const needsTop8 = t.kind === "ucl" && !hasTop8.has(uid);
        if (!needsBonus && !needsTop8) continue;
        const es = (prof.preferred_language ?? "es") === "es";
        const parts = [
          needsBonus ? (es ? "campeón, goleador y jugador de la temporada" : "champion, top scorer and player of the season") : null,
          needsTop8 ? "Top 8" : null,
        ].filter(Boolean).join(es ? " y " : " and ");
        const when = fmtWhen(t.picks_lock_at as string, es);
        const unsubUrl = `${APP_URL}/api/unsubscribe?u=${uid}&s=${signUnsub(uid, secret)}&l=${es ? "es" : "en"}`;
        planned.push({
          kind: "picks", tournamentId: t.id, roundKey: "lock", userId: uid,
          name: prof.display_name as string, es,
          subject: es ? `🏆 Tus picks de temporada cierran pronto` : `🏆 Your season picks lock soon`,
          detail: `missing: ${parts}`,
          html: render({
            es, name: prof.display_name as string, tournament: tName(es), unsubUrl,
            heading: es ? `Hola ${prof.display_name}` : `Hi ${prof.display_name}`,
            body: es
              ? `Los picks de temporada cierran <b style="color:#fff">${when} ET</b> y todavía te falta: <b style="color:#F2C452">${parts}</b>. Valen hasta 50 puntos el campeón, 25 el goleador, 25 el jugador y hasta 60 el Top 8.`
              : `Season picks lock <b style="color:#fff">${when} ET</b> and you still need: <b style="color:#F2C452">${parts}</b>. Champion is worth 50, top scorer 25, player 25, and the Top 8 up to 60.`,
            cta: es ? "Elegir mis picks" : "Make my picks",
            href: `${APP_URL}/${es ? "es" : "en"}/bonuses`,
          }),
        });
      }
    }
  }

  // Never print addresses: dry output is names + what's missing only.
  if (dry) {
    return NextResponse.json({
      ok: true, dry: true, asof: new Date(nowMs).toISOString(), planned: planned.length,
      unreachable: planned.filter((p) => !emailById.has(p.userId)).map((p) => p.name),
      recipients: planned.map((p) => ({ kind: p.kind, name: p.name, lang: p.es ? "es" : "en", detail: p.detail })),
    });
  }

  let sent = 0, duplicate = 0;
  const errors: string[] = [];
  for (const p of planned) {
    const to = emailById.get(p.userId);
    if (!to) continue;
    const key = { user_id: p.userId, tournament_id: p.tournamentId, kind: p.kind, round_key: p.roundKey };
    const { data: fresh } = await supabase
      .from("reminder_log").upsert(key, { onConflict: "user_id,tournament_id,kind,round_key", ignoreDuplicates: true }).select("user_id");
    if (!fresh || fresh.length === 0) { duplicate++; continue; }
    const unsubUrl = `${APP_URL}/api/unsubscribe?u=${p.userId}&s=${signUnsub(p.userId, secret)}&l=${p.es ? "es" : "en"}`;
    if (await sendEmail(to, p.subject, p.html, unsubUrl)) sent++;
    else {
      await supabase.from("reminder_log").delete().match(key); // let the next run retry
      errors.push(p.name);
    }
  }
  return NextResponse.json({ ok: errors.length === 0, planned: planned.length, sent, duplicate, failed: errors });
}
