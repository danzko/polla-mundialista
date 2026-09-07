/**
 * Seed the 2026-27 Champions League league phase from ESPN's public API:
 * the 36 clubs (with crests) and the 144 league-phase fixtures, numbered
 * 1..144 in kickoff order, matchday derived from the fixture-date clusters.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-ucl.ts
 *   DRY_RUN=1 npx tsx scripts/seed-ucl.ts     # fetch + validate only, no writes
 *
 * Idempotent: upserts on (tournament_id, code) / (tournament_id, match_number).
 * Knockout fixtures (Feb 2027+) are seeded separately once the draws happen.
 */
import { createClient } from "@supabase/supabase-js";

const UCL_ID = "a0000000-0000-4000-8000-000000002627";
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions";

const DRY = process.env.DRY_RUN === "1";
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!DRY && (!url || !key)) { console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const supabase = createClient(url || "https://dry.run.invalid", key || "dry");

async function main() {
  // ---- teams ----
  const teamsRes = await fetch(`${ESPN}/teams?limit=100`).then((r) => r.json());
  const clubs: Array<{ code: string; name: string; logo: string }> =
    teamsRes.sports[0].leagues[0].teams.map((t: any) => ({
      code: t.team.abbreviation as string,
      name: t.team.displayName as string,
      logo: (t.team.logos?.[0]?.href as string) ?? null,
    }));
  console.log(`ESPN clubs: ${clubs.length}`);
  if (DRY) {
    // Validate the fixture parse without touching the database.
    const sb = await fetch(`${ESPN}/scoreboard?dates=20260901-20270201&limit=400`).then((r) => r.json());
    const events: any[] = (sb.events ?? []).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let md = 0, prev = 0; const per: Record<number, number> = {};
    for (const e of events) { const ms = new Date(e.date).getTime(); if (ms - prev > 4 * 86_400_000) md++; prev = ms; per[md] = (per[md] ?? 0) + 1; }
    const codes = new Set(clubs.map((c) => c.code));
    const unknown = events.flatMap((e) => e.competitions[0].competitors.map((c: any) => c.team.abbreviation)).filter((a: string) => !codes.has(a));
    console.log(`fixtures: ${events.length}; per matchday:`, per, `; unknown club codes: ${unknown.length}`);
    return;
  }
  const { data: teamRows, error: tErr } = await supabase
    .from("teams")
    .upsert(
      clubs.map((c) => ({
        tournament_id: UCL_ID,
        code: c.code,
        name_en: c.name,
        name_es: c.name,
        flag_emoji: "",
        logo_url: c.logo,
        group: null,
        group_position: null,
      })),
      { onConflict: "tournament_id,code" },
    )
    .select("id, code");
  if (tErr) { console.error("teams:", tErr); process.exit(1); }
  const idByCode = new Map((teamRows ?? []).map((t) => [t.code as string, t.id as string]));
  console.log(`teams upserted: ${teamRows?.length}`);

  // ---- league-phase fixtures (Sept 2026 -> Jan 2027) ----
  const sb = await fetch(`${ESPN}/scoreboard?dates=20260901-20270201&limit=400`).then((r) => r.json());
  const events: any[] = (sb.events ?? []).filter((e: any) => (e.season?.slug ?? "league-phase") === "league-phase");
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || String(a.id).localeCompare(String(b.id)));
  console.log(`ESPN league-phase events: ${events.length}`);
  if (events.length !== 144) console.warn("expected 144 fixtures — check the date window");

  // Matchday = cluster of fixture dates separated by > 4 days.
  let matchday = 0; let prevMs = 0;
  const rows = events.map((e, i) => {
    const comp = e.competitions[0];
    const home = comp.competitors.find((c: any) => c.homeAway === "home").team.abbreviation as string;
    const away = comp.competitors.find((c: any) => c.homeAway === "away").team.abbreviation as string;
    const ms = new Date(e.date).getTime();
    if (ms - prevMs > 4 * 86_400_000) matchday++;
    prevMs = ms;
    const homeId = idByCode.get(home), awayId = idByCode.get(away);
    if (!homeId || !awayId) console.warn(`unknown club in #${i + 1}: ${home} / ${away}`);
    return {
      tournament_id: UCL_ID,
      match_number: i + 1,
      stage: "league",
      matchday,
      kickoff_at: new Date(e.date).toISOString(),
      home_team_id: homeId ?? null,
      away_team_id: awayId ?? null,
      venue: comp.venue?.fullName ?? null,
      group_label: null,
    };
  });
  const { data: mRows, error: mErr } = await supabase
    .from("matches")
    .upsert(rows, { onConflict: "tournament_id,match_number" })
    .select("match_number, matchday");
  if (mErr) { console.error("matches:", mErr); process.exit(1); }
  const perMd = new Map<number, number>();
  for (const r of mRows ?? []) perMd.set(r.matchday, (perMd.get(r.matchday) ?? 0) + 1);
  console.log(`matches upserted: ${mRows?.length}; per matchday:`, Object.fromEntries(perMd));
}

main().catch((e) => { console.error(e); process.exit(1); });
