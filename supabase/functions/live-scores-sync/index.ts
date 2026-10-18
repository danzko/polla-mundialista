/**
 * live-scores-sync — polls ESPN's public scoreboard for EVERY non-archived
 * tournament (tournaments.espn_league) and stages scores into `live_scores`
 * + a per-tournament `live_sync_state` heartbeat. Invoked every 2 minutes by
 * pg_cron (`live-scores-sync-2min`) via net.http_post with the anon key.
 *
 * Event → match mapping (per tournament):
 *   1. sticky by the stored provider_event_id
 *   2. team-code pair (ESPN abbreviations == our team codes), closest kickoff
 *   3. knockout placeholders (teams TBD): unique exact-kickoff team-less fixture
 * Scores are stored oriented to OUR home/away.
 *
 * AUTO-CONFIRM: a final that has been stable for STABLE_MS flows into
 * match_results (source 'espn-auto') via insert-if-missing — a human-entered
 * result is never overwritten. AUTO-HEAL: kickoff drift on un-started matches
 * adopts ESPN's time while both clocks put kickoff > 30 min away.
 * AUTO-ASSIGN: knockout slots fill from ESPN once known; advancers stamped
 * (incl. penalty winners) only where still null.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const ESPN = (league: string) =>
  `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard`;

const DAY_MS = 86_400_000;
const STABLE_MS = 5 * 60_000;
// Per-day ESPN fetches: how far back to chase missing results, and the cap
// on requests per run so a long gap can't burst hundreds of calls at once.
const LOOKBACK_DAYS = 30;
const MAX_DAYS_PER_RUN = 10;
// Stages whose games never feed a bracket.
const LEAGUE = new Set(["group", "league"]);

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}
function numOrNull(v: unknown): number | null {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}
function codeOf(rel: unknown): string | null {
  const r = Array.isArray(rel) ? rel[0] : rel;
  return (r as { code?: string } | null)?.code ?? null;
}

// Team identity is matched on code OR club name, normalized. ESPN's
// abbreviations are not stable (Oct 2026: Viking FK's "VIK" became
// "Viking FK"), and trusting the abbreviation alone silently drops games.
const norm = (v: unknown) =>
  String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Our side's identifiers: {code, name_en} normalized. null when the slot is TBD. */
function keysOf(rel: unknown): Set<string> | null {
  const r = (Array.isArray(rel) ? rel[0] : rel) as { code?: string; name_en?: string } | null;
  if (!r) return null;
  const out = new Set<string>();
  if (r.code) out.add(norm(r.code));
  if (r.name_en) out.add(norm(r.name_en));
  return out.size > 0 ? out : null;
}

/** Does our side refer to the same club as this ESPN competitor? */
const sameTeam = (ours: Set<string> | null, ab: string, name: string) =>
  !!ours && (ours.has(norm(ab)) || ours.has(norm(name)));

type Counts = { events_seen?: number; matched?: number; unmatched?: number; drift_count?: number };
type Outcome = { ok: boolean; counts: Counts; message: string | null };

// deno-lint-ignore no-explicit-any
async function syncTournament(supabase: any, t: any): Promise<Outcome> {
  const nowMs = Date.now();

  const { data: matches, error: mErr } = await supabase
    .from("matches")
    .select(
      "id, match_number, kickoff_at, stage, is_voided, home:teams!matches_home_team_id_fkey(code, name_en), away:teams!matches_away_team_id_fkey(code, name_en), match_results(match_id)",
    )
    .eq("tournament_id", t.id);
  if (mErr) return { ok: false, counts: {}, message: `db matches: ${mErr.message}` };
  const matchIds = new Set((matches ?? []).map((m: any) => m.id as string));

  // ESPN dropped date-RANGE support on the scoreboard endpoint (Oct 2026:
  // any `dates=A-B` returns 400), so fetch one day at a time. Which days:
  // every fixture inside the window that still has NO recorded result,
  // padded ±1 day for kickoff/timezone drift. That covers live games, finals
  // waiting to confirm, the week ahead, AND any historical gap (a sync
  // outage self-heals instead of needing a manual backfill). Quiet weeks
  // cost zero requests.
  const hasResult = (m: any) =>
    Array.isArray(m.match_results) ? m.match_results.length > 0 : !!m.match_results;
  const dayKeys = new Set<string>();
  for (const m of matches ?? []) {
    if (m.is_voided || hasResult(m)) continue;
    const k = new Date(m.kickoff_at).getTime();
    if (k < nowMs - LOOKBACK_DAYS * DAY_MS || k > nowMs + 6 * DAY_MS) continue;
    for (const off of [-DAY_MS, 0, DAY_MS]) dayKeys.add(ymd(new Date(k + off)));
  }
  const days = [...dayKeys].sort().slice(0, MAX_DAYS_PER_RUN);

  // deno-lint-ignore no-explicit-any
  const events: any[] = [];
  const fetchErrors: string[] = [];
  for (const day of days) {
    try {
      const res = await fetch(`${ESPN(t.espn_league)}?dates=${day}&limit=100`, {
        headers: { "user-agent": "polla-mundialista/2.0 (live results sync)" },
      });
      if (!res.ok) { fetchErrors.push(`${day}:HTTP ${res.status}`); continue; }
      const data = await res.json();
      for (const ev of data?.events ?? []) events.push(ev);
    } catch (e) {
      fetchErrors.push(`${day}:${String(e).slice(0, 60)}`);
    }
  }
  // Every requested day failed: report it instead of silently "0 events".
  if (days.length > 0 && events.length === 0 && fetchErrors.length === days.length) {
    return { ok: false, counts: {}, message: `ESPN ${fetchErrors.slice(0, 3).join(", ")}` };
  }

  const { data: existingAll, error: eErr } = await supabase
    .from("live_scores")
    .select("match_id, provider_event_id, home_score, away_score, status, changed_at");
  if (eErr) return { ok: false, counts: { events_seen: events.length }, message: `db live_scores: ${eErr.message}` };
  const existing = (existingAll ?? []).filter((r: any) => matchIds.has(r.match_id));

  const byEventId = new Map(
    existing.filter((r: any) => r.provider_event_id).map((r: any) => [String(r.provider_event_id), r]),
  );
  const existingByMatch = new Map(existing.map((r: any) => [r.match_id as string, r]));
  const mappedMatchIds = new Set(existing.map((r: any) => r.match_id as string));

  const used = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  const matched: Array<{
    matchId: string; stage: string; bothUnassigned: boolean;
    homeAb: string; awayAb: string; winnerAb: string | null; completed: boolean;
  }> = [];
  const unmatched: string[] = [];
  let driftCount = 0;

  for (const ev of events) {
    const comp = ev?.competitions?.[0];
    if (!comp) continue;
    // deno-lint-ignore no-explicit-any
    const homeC = comp.competitors?.find((c: any) => c.homeAway === "home");
    // deno-lint-ignore no-explicit-any
    const awayC = comp.competitors?.find((c: any) => c.homeAway === "away");
    if (!homeC || !awayC) continue;

    const evId = String(ev.id);
    const evKick = new Date(ev.date ?? comp.date);
    const homeAb: string = homeC.team?.abbreviation ?? "";
    const awayAb: string = awayC.team?.abbreviation ?? "";
    const homeNm: string = homeC.team?.displayName ?? "";
    const awayNm: string = awayC.team?.displayName ?? "";

    // 1) sticky by stored event id
    let match = (() => {
      const prev = byEventId.get(evId);
      if (!prev) return null;
      return (matches ?? []).find((m: any) => m.id === prev.match_id) ?? null;
    })();

    // 2) by team-code pair, closest kickoff
    if (!match) {
      const candidates = (matches ?? []).filter((m: any) => {
        if (used.has(m.id)) return false;
        const hk = keysOf(m.home);
        const ak = keysOf(m.away);
        if (!hk || !ak) return false;
        return (sameTeam(hk, homeAb, homeNm) && sameTeam(ak, awayAb, awayNm)) ||
               (sameTeam(hk, awayAb, awayNm) && sameTeam(ak, homeAb, homeNm));
      });
      candidates.sort(
        (x: any, y: any) =>
          Math.abs(new Date(x.kickoff_at).getTime() - evKick.getTime()) -
          Math.abs(new Date(y.kickoff_at).getTime() - evKick.getTime()),
      );
      const best = candidates[0];
      if (best && Math.abs(new Date(best.kickoff_at).getTime() - evKick.getTime()) < 14 * DAY_MS) {
        match = best;
      }
    }

    // 3) knockout placeholders: unique exact-kickoff team-less fixture
    if (!match) {
      const candidates = (matches ?? []).filter(
        (m: any) =>
          !used.has(m.id) &&
          !mappedMatchIds.has(m.id) &&
          (codeOf(m.home) === null || codeOf(m.away) === null) &&
          new Date(m.kickoff_at).getTime() === evKick.getTime(),
      );
      if (candidates.length === 1) match = candidates[0];
    }

    if (!match) {
      unmatched.push(`${homeAb}-${awayAb}@${ev.date ?? "?"}`);
      continue;
    }
    used.add(match.id);

    // Our home side listed as ESPN's away side -> flip the scoreline.
    const swapped = sameTeam(keysOf(match.home), awayAb, awayNm);

    const hs = numOrNull(homeC.score);
    const as_ = numOrNull(awayC.score);
    const [ourHome, ourAway] = swapped ? [as_, hs] : [hs, as_];

    const st = comp.status ?? ev.status;
    const state: string = st?.type?.state ?? "pre";
    const completed = Boolean(st?.type?.completed);

    let winnerAb: string | null =
      homeC.winner === true ? homeAb : awayC.winner === true ? awayAb : null;
    if (!winnerAb && completed && hs !== null && as_ !== null && hs !== as_) {
      winnerAb = hs > as_ ? homeAb : awayAb;
    }
    if (!LEAGUE.has(match.stage)) {
      matched.push({
        matchId: match.id,
        stage: match.stage,
        bothUnassigned: keysOf(match.home) === null && keysOf(match.away) === null,
        homeAb: homeNm || homeAb,
        awayAb: awayNm || awayAb,
        winnerAb: winnerAb === homeAb ? (homeNm || homeAb) : winnerAb === awayAb ? (awayNm || awayAb) : winnerAb,
        completed,
      });
    }

    const drift = match.kickoff_at
      ? Math.round((evKick.getTime() - new Date(match.kickoff_at).getTime()) / 1000)
      : null;
    if (drift !== null && Math.abs(drift) >= 60) driftCount++;

    const prevRow = existingByMatch.get(match.id);
    const changed =
      !prevRow ||
      prevRow.home_score !== ourHome ||
      prevRow.away_score !== ourAway ||
      prevRow.status !== state;

    rows.push({
      match_id: match.id,
      provider: "espn",
      provider_event_id: evId,
      home_score: ourHome,
      away_score: ourAway,
      status: state,
      status_detail: st?.type?.detail ?? null,
      display_clock: st?.displayClock ?? null,
      completed,
      provider_kickoff_at: evKick.toISOString(),
      kickoff_drift_seconds: drift,
      provider_home: homeC.team?.displayName ?? homeAb,
      provider_away: awayC.team?.displayName ?? awayAb,
      fetched_at: new Date().toISOString(),
      changed_at: changed ? new Date().toISOString() : (prevRow?.changed_at ?? null),
    });
  }

  if (rows.length > 0) {
    const { error: upErr } = await supabase.from("live_scores").upsert(rows, { onConflict: "match_id" });
    if (upErr) {
      return {
        ok: false,
        counts: { events_seen: events.length, matched: rows.length, unmatched: unmatched.length },
        message: `upsert: ${upErr.message}`,
      };
    }
  }

  // AUTO-CONFIRM stable finals into match_results.
  const notes: string[] = [];
  const matchById = new Map((matches ?? []).map((m: any) => [m.id as string, m]));
  const candidates = rows.filter((r) => {
    if (r.status !== "post" || !r.completed) return false;
    if (r.home_score === null || r.away_score === null) return false;
    const m = matchById.get(r.match_id as string);
    if (!m || m.is_voided) return false;
    if (!codeOf(m.home) || !codeOf(m.away)) return false;
    const changedMs = r.changed_at ? new Date(r.changed_at as string).getTime() : 0;
    return Date.now() - changedMs >= STABLE_MS;
  });
  if (candidates.length > 0) {
    const { data: inserted, error: acErr } = await supabase
      .from("match_results")
      .upsert(
        candidates.map((r) => ({
          match_id: r.match_id,
          home_score: r.home_score,
          away_score: r.away_score,
          recorded_by: null,
          recorded_at: new Date().toISOString(),
          source: "espn-auto",
        })),
        { onConflict: "match_id", ignoreDuplicates: true },
      )
      .select("match_id");
    if (acErr) {
      notes.push(`auto-confirm error: ${acErr.message}`);
    } else if (inserted && inserted.length > 0) {
      const label = (id: string) => {
        const m = matchById.get(id);
        const r = rows.find((x) => x.match_id === id);
        return m && r ? `${codeOf(m.home)} ${r.home_score}-${r.away_score} ${codeOf(m.away)}` : id;
      };
      notes.push(`auto: ${inserted.map((i: any) => label(i.match_id as string)).join(", ")}`);
    }
  }

  // AUTO-HEAL kickoff drift on un-started matches.
  const healed: string[] = [];
  for (const r of rows) {
    const drift = r.kickoff_drift_seconds as number | null;
    if (drift === null || Math.abs(drift) < 60) continue;
    if (r.status !== "pre") continue;
    const m = matchById.get(r.match_id as string);
    if (!m || m.is_voided) continue;
    const ourKick = new Date(m.kickoff_at).getTime();
    const provKick = new Date(r.provider_kickoff_at as string).getTime();
    if (ourKick - Date.now() < 30 * 60_000 || provKick - Date.now() < 30 * 60_000) continue;
    const { error: hErr } = await supabase
      .from("matches").update({ kickoff_at: r.provider_kickoff_at }).eq("id", r.match_id);
    if (hErr) { notes.push(`hora error #${m.match_number}: ${hErr.message}`); continue; }
    healed.push(`#${m.match_number} -> ${r.provider_kickoff_at}`);
  }
  if (healed.length > 0) notes.push(`hora auto: ${healed.join(", ")}`);

  // AUTO-ASSIGN real knockout teams + record advancers (fill-only).
  if (matched.length > 0) {
    const { data: teamRows } = await supabase.from("teams").select("id, code, name_en").eq("tournament_id", t.id);
    const codeToId = new Map<string, string>();
    for (const x of teamRows ?? []) {
      if (x.code) codeToId.set(norm(x.code), x.id as string);
      if (x.name_en) codeToId.set(norm(x.name_en), x.id as string);
    }
    let teamsAssigned = 0;
    let advancersSet = 0;
    for (const km of matched) {
      const hId = codeToId.get(norm(km.homeAb));
      const aId = codeToId.get(norm(km.awayAb));
      if (km.bothUnassigned && hId && aId) {
        const { error } = await supabase
          .from("matches")
          .update({ home_team_id: hId, away_team_id: aId })
          .eq("id", km.matchId)
          .is("home_team_id", null);
        if (!error) teamsAssigned++;
      }
      if (km.completed && km.winnerAb) {
        const wId = codeToId.get(norm(km.winnerAb));
        if (wId) {
          const { error } = await supabase
            .from("match_results")
            .update({ advanced_team_id: wId })
            .eq("match_id", km.matchId)
            .is("advanced_team_id", null);
          if (!error) advancersSet++;
        }
      }
    }
    if (teamsAssigned > 0) notes.push(`KO teams assigned: ${teamsAssigned}`);
    if (advancersSet > 0) notes.push(`KO advancers: ${advancersSet}`);
  }

  if (unmatched.length > 0) notes.push(`unmatched: ${unmatched.join(", ")}`);
  if (fetchErrors.length > 0) notes.push(`fetch: ${fetchErrors.slice(0, 3).join(", ")}`);

  return {
    ok: true,
    counts: { events_seen: events.length, matched: rows.length, unmatched: unmatched.length, drift_count: driftCount },
    message: notes.length > 0 ? notes.join(" | ").slice(0, 300) : null,
  };
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Every non-archived tournament whose window overlaps the polling window.
  const { data: tournaments, error: tErr } = await supabase
    .from("tournaments")
    .select("id, slug, espn_league, status, starts_at, ends_at")
    .neq("status", "archived")
    .order("starts_at", { ascending: true });
  if (tErr) {
    return new Response(JSON.stringify({ ok: false, message: `db tournaments: ${tErr.message}` }), { status: 500 });
  }
  const nowMs = Date.now();
  const results: Record<string, Outcome> = {};
  // ponytail: live_sync_state.id is a smallint PK; the WC row is id 1. Later
  // tournaments get 1 + their position in starts_at order (stable as long as
  // no tournament is inserted before an existing one).
  const { data: allT } = await supabase.from("tournaments").select("id").order("starts_at", { ascending: true });
  const idOf = new Map((allT ?? []).map((x: any, i: number) => [x.id as string, i + 1]));

  for (const t of tournaments ?? []) {
    const startsMs = t.starts_at ? new Date(t.starts_at).getTime() : 0;
    const endsMs = t.ends_at ? new Date(t.ends_at).getTime() : Infinity;
    if (startsMs > nowMs + 7 * DAY_MS || endsMs < nowMs - 2 * DAY_MS) continue;
    let out: Outcome;
    try {
      out = await syncTournament(supabase, t);
    } catch (e) {
      out = { ok: false, counts: {}, message: String(e).slice(0, 300) };
    }
    results[t.slug] = out;
    await supabase.from("live_sync_state").upsert({
      id: idOf.get(t.id) ?? 99,
      tournament_id: t.id,
      last_run_at: new Date().toISOString(),
      ok: out.ok,
      events_seen: out.counts.events_seen ?? 0,
      matched: out.counts.matched ?? 0,
      unmatched: out.counts.unmatched ?? 0,
      drift_count: out.counts.drift_count ?? 0,
      message: out.message,
    }, { onConflict: "tournament_id" });
  }

  const ok = Object.values(results).every((r) => r.ok);
  return new Response(JSON.stringify({ ok, results }), {
    status: ok ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });
});
