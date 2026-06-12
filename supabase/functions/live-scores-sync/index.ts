/**
 * live-scores-sync — polls ESPN's public World Cup scoreboard and stages
 * what it reports into public.live_scores; stable finals then
 * auto-confirm into match_results (see AUTO-CONFIRM below). Existing
 * results are never touched — overrides stay human, from /admin.
 *
 * Deployed on Supabase Edge Functions, invoked every 2 minutes by pg_cron
 * via net.http_post with the project anon key (verify_jwt is on).
 *
 * Mapping ESPN event -> our match, in priority order:
 *   1. provider_event_id already stored in live_scores (sticky)
 *   2. team-code pair: ESPN abbreviations are exactly our FIFA codes
 *      (verified bijection across all 48 teams), order-insensitive,
 *      closest kickoff wins
 *   3. knockout placeholders (teams TBD on both sides): unique exact
 *      kickoff match among our team-less fixtures — pins the event id
 *      days before teams are assigned
 *
 * live_scores.home_score/away_score are oriented to OUR home/away
 * columns; scores are swapped if ESPN lists the fixture reversed.
 * kickoff_drift_seconds = ESPN kickoff - ours (drives admin alerts).
 *
 * AUTO-CONFIRM (owner decision June 12): a final flows into
 * match_results (source 'espn-auto', recorded_by null) once its score
 * has been stable for STABLE_MS past full time. Inserted with
 * ON CONFLICT DO NOTHING — a human-entered or corrected result is
 * never overwritten; corrections go through the admin mismatch alert.
 *
 * AUTO-HEAL (owner: "make it auto", June 12): kickoff drift on
 * not-yet-started matches adopts ESPN's time automatically, but only
 * while BOTH clocks put kickoff >30 min away — anything closer stays
 * an admin alert. Self-correcting: if ESPN reverts, so do we.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const ESPN_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

const DAY_MS = 86_400_000;

// A final must hold this long (score + status unchanged) before it
// auto-confirms — catches last-second corrections at the whistle.
const STABLE_MS = 5 * 60_000;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

function numOrNull(v: unknown): number | null {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

// Supabase to-one embeds arrive as object, but guard the array shape too.
function codeOf(rel: unknown): string | null {
  const r = Array.isArray(rel) ? rel[0] : rel;
  return (r as { code?: string } | null)?.code ?? null;
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const nowMs = Date.now();

  const finish = async (
    ok: boolean,
    counts: { events_seen?: number; matched?: number; unmatched?: number; drift_count?: number },
    message: string | null,
  ) => {
    await supabase.from("live_sync_state").upsert({
      id: 1,
      last_run_at: new Date().toISOString(),
      ok,
      events_seen: counts.events_seen ?? 0,
      matched: counts.matched ?? 0,
      unmatched: counts.unmatched ?? 0,
      drift_count: counts.drift_count ?? 0,
      message,
    });
    return new Response(JSON.stringify({ ok, ...counts, message }), {
      status: ok ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const from = new Date(nowMs - 2 * DAY_MS);
    const to = new Date(nowMs + 6 * DAY_MS);
    const res = await fetch(`${ESPN_BASE}?dates=${ymd(from)}-${ymd(to)}&limit=300`, {
      headers: { "user-agent": "polla-mundialista/1.0 (live results sync)" },
    });
    if (!res.ok) return await finish(false, {}, `ESPN HTTP ${res.status}`);
    const data = await res.json();
    // deno-lint-ignore no-explicit-any
    const events: any[] = data?.events ?? [];

    // All 104 matches — tiny table, and a full fetch makes sticky
    // mappings immune to window-edge mismatches.
    const { data: matches, error: mErr } = await supabase
      .from("matches")
      .select(
        "id, match_number, kickoff_at, stage, is_voided, home:teams!matches_home_team_id_fkey(code), away:teams!matches_away_team_id_fkey(code)",
      );
    if (mErr) return await finish(false, { events_seen: events.length }, `db matches: ${mErr.message}`);

    const { data: existing, error: eErr } = await supabase
      .from("live_scores")
      .select("match_id, provider_event_id, home_score, away_score, status, changed_at");
    if (eErr) return await finish(false, { events_seen: events.length }, `db live_scores: ${eErr.message}`);

    const byEventId = new Map(
      (existing ?? [])
        .filter((r) => r.provider_event_id)
        .map((r) => [String(r.provider_event_id), r]),
    );
    const existingByMatch = new Map((existing ?? []).map((r) => [r.match_id as string, r]));
    const mappedMatchIds = new Set((existing ?? []).map((r) => r.match_id as string));

    const used = new Set<string>();
    const rows: Record<string, unknown>[] = [];
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

      // 1) sticky by stored event id
      let match = (() => {
        const prev = byEventId.get(evId);
        if (!prev) return null;
        return (matches ?? []).find((m) => m.id === prev.match_id) ?? null;
      })();

      // 2) by team-code pair, closest kickoff
      if (!match) {
        const candidates = (matches ?? []).filter((m) => {
          if (used.has(m.id)) return false;
          const h = codeOf(m.home);
          const a = codeOf(m.away);
          if (!h || !a) return false;
          return (h === homeAb && a === awayAb) || (h === awayAb && a === homeAb);
        });
        candidates.sort(
          (x, y) =>
            Math.abs(new Date(x.kickoff_at).getTime() - evKick.getTime()) -
            Math.abs(new Date(y.kickoff_at).getTime() - evKick.getTime()),
        );
        const best = candidates[0];
        if (
          best &&
          Math.abs(new Date(best.kickoff_at).getTime() - evKick.getTime()) < 14 * DAY_MS
        ) {
          match = best;
        }
      }

      // 3) knockout placeholders: unique exact-kickoff team-less fixture
      if (!match) {
        const candidates = (matches ?? []).filter(
          (m) =>
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

      const ourHomeCode = codeOf(match.home);
      const swapped = ourHomeCode !== null && ourHomeCode === awayAb;

      const hs = numOrNull(homeC.score);
      const as_ = numOrNull(awayC.score);
      const [ourHome, ourAway] = swapped ? [as_, hs] : [hs, as_];

      const st = comp.status ?? ev.status;
      const state: string = st?.type?.state ?? "pre";
      const completed = Boolean(st?.type?.completed);

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
      const { error: upErr } = await supabase
        .from("live_scores")
        .upsert(rows, { onConflict: "match_id" });
      if (upErr) {
        return await finish(
          false,
          { events_seen: events.length, matched: rows.length, unmatched: unmatched.length },
          `upsert: ${upErr.message}`,
        );
      }
    }

    // AUTO-CONFIRM stable finals into match_results.
    const notes: string[] = [];
    const matchById = new Map((matches ?? []).map((m) => [m.id as string, m]));
    const candidates = rows.filter((r) => {
      if (r.status !== "post" || !r.completed) return false;
      if (r.home_score === null || r.away_score === null) return false;
      const m = matchById.get(r.match_id as string);
      if (!m || m.is_voided) return false;
      if (!codeOf(m.home) || !codeOf(m.away)) return false;
      // null changed_at only on pre-heuristic rows: treat as ancient/stable
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
          return m && r
            ? `${codeOf(m.home)} ${r.home_score}-${r.away_score} ${codeOf(m.away)}`
            : id;
        };
        notes.push(`auto: ${inserted.map((i) => label(i.match_id as string)).join(", ")}`);
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
        .from("matches")
        .update({ kickoff_at: r.provider_kickoff_at })
        .eq("id", r.match_id);
      if (hErr) {
        notes.push(`hora error #${m.match_number}: ${hErr.message}`);
        continue;
      }
      healed.push(`#${m.match_number} -> ${r.provider_kickoff_at}`);
    }
    if (healed.length > 0) notes.push(`hora auto: ${healed.join(", ")}`);

    if (unmatched.length > 0) notes.push(`unmatched: ${unmatched.join(", ")}`);

    return await finish(
      true,
      {
        events_seen: events.length,
        matched: rows.length,
        unmatched: unmatched.length,
        drift_count: driftCount,
      },
      notes.length > 0 ? notes.join(" | ").slice(0, 300) : null,
    );
  } catch (e) {
    return await finish(false, {}, String(e).slice(0, 300));
  }
});
