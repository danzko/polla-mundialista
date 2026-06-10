import * as React from "react";
import { createClient } from "@/lib/supabase/server";
import { ResultRow, type RowMatch } from "./ResultRow";

export const dynamic = "force-dynamic";

export default async function AdminResultsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();

  const { data: matches } = await supabase
    .from("matches")
    .select(
      `*,
       home_team:teams!matches_home_team_id_fkey (*),
       away_team:teams!matches_away_team_id_fkey (*),
       match_results (*)`
    )
    .order("kickoff_at", { ascending: true });

  const rows: RowMatch[] = (matches ?? []).map((m: any) => {
    const r = Array.isArray(m.match_results) ? m.match_results[0] : m.match_results;
    return {
      id: m.id,
      matchNumber: m.match_number,
      stage: m.stage,
      groupLabel: m.group_label,
      kickoffAt: m.kickoff_at,
      isVoided: m.is_voided,
      homeTeam: m.home_team
        ? {
            code: m.home_team.code,
            nameEs: m.home_team.name_es,
            flagEmoji: m.home_team.flag_emoji,
          }
        : null,
      awayTeam: m.away_team
        ? {
            code: m.away_team.code,
            nameEs: m.away_team.name_es,
            flagEmoji: m.away_team.flag_emoji,
          }
        : null,
      result: r ? { homeScore: r.home_score, awayScore: r.away_score } : null,
    };
  });

  const withResult = rows.filter((r) => r.result).length;

  return (
    <div className="space-y-3">
      <div className="mb-2 text-sm text-muted-foreground">
        {withResult} de {rows.length} partidos con resultado
      </div>
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay partidos cargados.</p>
      )}
      {rows.map((m) => (
        <ResultRow key={m.id} match={m} locale={locale} />
      ))}
    </div>
  );
}
