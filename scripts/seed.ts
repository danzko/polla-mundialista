/**
 * Seed script: Inserts 48 teams and 72 group-stage matches into Supabase.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Requires:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 *   - wc2026-seed-data.json in the same directory
 *
 * This uses the service role key (bypasses RLS) so it can insert into
 * teams and matches tables which are normally superadmin-only.
 */

import { createClient } from "@supabase/supabase-js";
import seedData from "./wc2026-seed-data.json";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// FIFA 3-letter codes and flag emoji for each team
const TEAM_META: Record<string, { code: string; flag: string; name_es: string }> = {
  "Mexico": { code: "MEX", flag: "🇲🇽", name_es: "Mexico" },
  "South Africa": { code: "RSA", flag: "🇿🇦", name_es: "Sudafrica" },
  "South Korea": { code: "KOR", flag: "🇰🇷", name_es: "Corea del Sur" },
  "Czech Republic": { code: "CZE", flag: "🇨🇿", name_es: "Republica Checa" },
  "Canada": { code: "CAN", flag: "🇨🇦", name_es: "Canada" },
  "Bosnia and Herzegovina": { code: "BIH", flag: "🇧🇦", name_es: "Bosnia y Herzegovina" },
  "Qatar": { code: "QAT", flag: "🇶🇦", name_es: "Catar" },
  "Switzerland": { code: "SUI", flag: "🇨🇭", name_es: "Suiza" },
  "Brazil": { code: "BRA", flag: "🇧🇷", name_es: "Brasil" },
  "Morocco": { code: "MAR", flag: "🇲🇦", name_es: "Marruecos" },
  "Haiti": { code: "HAI", flag: "🇭🇹", name_es: "Haiti" },
  "Scotland": { code: "SCO", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", name_es: "Escocia" },
  "United States": { code: "USA", flag: "🇺🇸", name_es: "Estados Unidos" },
  "Paraguay": { code: "PAR", flag: "🇵🇾", name_es: "Paraguay" },
  "Australia": { code: "AUS", flag: "🇦🇺", name_es: "Australia" },
  "Turkey": { code: "TUR", flag: "🇹🇷", name_es: "Turquia" },
  "Germany": { code: "GER", flag: "🇩🇪", name_es: "Alemania" },
  "Curaçao": { code: "CUW", flag: "🇨🇼", name_es: "Curazao" },
  "Ivory Coast": { code: "CIV", flag: "🇨🇮", name_es: "Costa de Marfil" },
  "Ecuador": { code: "ECU", flag: "🇪🇨", name_es: "Ecuador" },
  "Netherlands": { code: "NED", flag: "🇳🇱", name_es: "Paises Bajos" },
  "Japan": { code: "JPN", flag: "🇯🇵", name_es: "Japon" },
  "Sweden": { code: "SWE", flag: "🇸🇪", name_es: "Suecia" },
  "Tunisia": { code: "TUN", flag: "🇹🇳", name_es: "Tunez" },
  "Belgium": { code: "BEL", flag: "🇧🇪", name_es: "Belgica" },
  "Egypt": { code: "EGY", flag: "🇪🇬", name_es: "Egipto" },
  "Iran": { code: "IRN", flag: "🇮🇷", name_es: "Iran" },
  "New Zealand": { code: "NZL", flag: "🇳🇿", name_es: "Nueva Zelanda" },
  "Spain": { code: "ESP", flag: "🇪🇸", name_es: "Espana" },
  "Cape Verde": { code: "CPV", flag: "🇨🇻", name_es: "Cabo Verde" },
  "Saudi Arabia": { code: "KSA", flag: "🇸🇦", name_es: "Arabia Saudita" },
  "Uruguay": { code: "URU", flag: "🇺🇾", name_es: "Uruguay" },
  "France": { code: "FRA", flag: "🇫🇷", name_es: "Francia" },
  "Senegal": { code: "SEN", flag: "🇸🇳", name_es: "Senegal" },
  "Iraq": { code: "IRQ", flag: "🇮🇶", name_es: "Irak" },
  "Norway": { code: "NOR", flag: "🇳🇴", name_es: "Noruega" },
  "Argentina": { code: "ARG", flag: "🇦🇷", name_es: "Argentina" },
  "Algeria": { code: "ALG", flag: "🇩🇿", name_es: "Argelia" },
  "Austria": { code: "AUT", flag: "🇦🇹", name_es: "Austria" },
  "Jordan": { code: "JOR", flag: "🇯🇴", name_es: "Jordania" },
  "Portugal": { code: "POR", flag: "🇵🇹", name_es: "Portugal" },
  "DR Congo": { code: "COD", flag: "🇨🇩", name_es: "RD Congo" },
  "Uzbekistan": { code: "UZB", flag: "🇺🇿", name_es: "Uzbekistan" },
  "Colombia": { code: "COL", flag: "🇨🇴", name_es: "Colombia" },
  "England": { code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", name_es: "Inglaterra" },
  "Croatia": { code: "CRO", flag: "🇭🇷", name_es: "Croacia" },
  "Ghana": { code: "GHA", flag: "🇬🇭", name_es: "Ghana" },
  "Panama": { code: "PAN", flag: "🇵🇦", name_es: "Panama" },
};

async function seed() {
  console.log("Seeding teams...");

  // Insert teams
  const teamsToInsert = seedData.teams.map((t) => {
    const meta = TEAM_META[t.name_en];
    if (!meta) {
      console.warn(`No metadata for team: ${t.name_en}`);
      return null;
    }
    return {
      code: meta.code,
      name_en: t.name_en,
      name_es: meta.name_es,
      flag_emoji: meta.flag,
      group: t.group,
      group_position: t.group_position,
    };
  }).filter(Boolean);

  const { data: insertedTeams, error: teamsError } = await supabase
    .from("teams")
    .upsert(teamsToInsert as any[], { onConflict: "code" })
    .select();

  if (teamsError) {
    console.error("Teams insert error:", teamsError);
    process.exit(1);
  }
  console.log(`Inserted/updated ${insertedTeams?.length} teams`);

  // Build team lookup by English name
  const { data: allTeams } = await supabase.from("teams").select("id, name_en");
  const teamByName = new Map(allTeams?.map((t) => [t.name_en, t.id]) ?? []);

  // Insert group stage matches
  console.log("Seeding group stage matches...");
  const matchesToInsert = seedData.group_matches.map((m) => {
    const homeId = teamByName.get(m.home);
    const awayId = teamByName.get(m.away);
    if (!homeId || !awayId) {
      console.warn(`Team not found: ${m.home} or ${m.away}`);
    }
    return {
      match_number: m.num,
      home_team_id: homeId ?? null,
      away_team_id: awayId ?? null,
      kickoff_at: m.kickoff ? new Date(m.kickoff).toISOString() : new Date("2026-06-11T19:00:00Z").toISOString(),
      stage: "group" as const,
      group_label: m.group,
    };
  });

  const { data: insertedMatches, error: matchesError } = await supabase
    .from("matches")
    .upsert(matchesToInsert, { onConflict: "match_number" })
    .select();

  if (matchesError) {
    console.error("Matches insert error:", matchesError);
    process.exit(1);
  }
  console.log(`Inserted/updated ${insertedMatches?.length} group matches`);

  // Insert knockout match shells (no teams yet, just match numbers 73-104)
  console.log("Seeding knockout match shells...");
  const knockoutStages: Record<string, { start: number; end: number; stage: string }> = {
    r32: { start: 73, end: 88, stage: "r32" },
    r16: { start: 89, end: 96, stage: "r16" },
    qf: { start: 97, end: 100, stage: "qf" },
    sf: { start: 101, end: 102, stage: "sf" },
    third_place: { start: 103, end: 103, stage: "third_place" },
    final: { start: 104, end: 104, stage: "final" },
  };

  const knockoutMatches = [];
  // Get knockout kickoff times (after the 72 group stage ones)
  const knockoutKickoffs = seedData.group_matches.length < 100
    ? [] // We'll use placeholder dates
    : [];

  for (const [, config] of Object.entries(knockoutStages)) {
    for (let num = config.start; num <= config.end; num++) {
      // Estimate kickoff dates for knockout (can be updated later)
      const dayOffset = num - 73;
      const baseDate = new Date("2026-07-01T19:00:00Z");
      baseDate.setDate(baseDate.getDate() + Math.floor(dayOffset / 2));

      knockoutMatches.push({
        match_number: num,
        home_team_id: null,
        away_team_id: null,
        kickoff_at: baseDate.toISOString(),
        stage: config.stage,
        group_label: null,
      });
    }
  }

  const { error: koError } = await supabase
    .from("matches")
    .upsert(knockoutMatches, { onConflict: "match_number" });

  if (koError) {
    console.error("Knockout matches insert error:", koError);
    process.exit(1);
  }
  console.log(`Inserted/updated ${knockoutMatches.length} knockout match shells`);

  console.log("\nSeed complete!");
  console.log(`Total: ${teamsToInsert.length} teams, ${matchesToInsert.length + knockoutMatches.length} matches`);
}

seed().catch(console.error);
