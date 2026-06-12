// Compares every DB kickoff against ESPN's public scoreboard.
// Group matches match by team-code pair (ESPN abbreviations == our FIFA
// codes); knockout matches (placeholder teams on ESPN) compare as a
// multiset of kickoff timestamps. Run: node scripts/verify-fixture-times.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: matches, error } = await supabase
  .from("matches")
  .select(
    "match_number, kickoff_at, stage, is_voided, home:teams!matches_home_team_id_fkey(code), away:teams!matches_away_team_id_fkey(code)"
  )
  .order("match_number");
if (error) throw error;

const res = await fetch(
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260610-20260720&limit=400"
);
const data = await res.json();
const events = data.events ?? [];

const evByPair = new Map();
const evTimes = [];
for (const e of events) {
  const c = e.competitions?.[0];
  if (!c) continue;
  const h = c.competitors.find((x) => x.homeAway === "home")?.team?.abbreviation;
  const a = c.competitors.find((x) => x.homeAway === "away")?.team?.abbreviation;
  const t = new Date(e.date).toISOString();
  evTimes.push(t);
  if (h && a) evByPair.set([h, a].sort().join("-"), { t, h, a });
}

let groupChecked = 0;
const groupMismatch = [];
const groupMissing = [];
for (const m of matches.filter((m) => m.stage === "group")) {
  const h = m.home?.code, a = m.away?.code;
  const ev = evByPair.get([h, a].sort().join("-"));
  if (!ev) { groupMissing.push(`#${m.match_number} ${h}-${a}`); continue; }
  groupChecked++;
  const ours = new Date(m.kickoff_at).toISOString();
  if (ours !== ev.t) groupMismatch.push(`#${m.match_number} ${h}-${a}: ours ${ours} espn ${ev.t}`);
}

const count = (arr) => arr.reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map());
const koOurs = matches
  .filter((m) => m.stage !== "group")
  .map((m) => new Date(m.kickoff_at).toISOString())
  .sort();
const espnC = count(evTimes);
for (const m of matches.filter((m) => m.stage === "group")) {
  const t = new Date(m.kickoff_at).toISOString();
  if (espnC.get(t)) espnC.set(t, espnC.get(t) - 1);
}
const koProblems = [];
for (const [t, n] of count(koOurs)) {
  const have = espnC.get(t) ?? 0;
  if (have < n) koProblems.push(`${t}: ours x${n}, espn x${have}`);
  else espnC.set(t, have - n);
}

console.log(
  JSON.stringify(
    {
      db_matches: matches.length,
      espn_events: events.length,
      group_checked: groupChecked,
      group_time_mismatches: groupMismatch,
      group_not_found_on_espn: groupMissing,
      knockout_slots: koOurs.length,
      knockout_time_problems: koProblems,
    },
    null,
    1
  )
);
