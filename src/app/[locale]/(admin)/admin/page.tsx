import * as React from "react";
import { createClient } from "@/lib/supabase/server";
import { ResultRow, type RowMatch } from "./ResultRow";
import { LivePanel, type LiveItem, type SyncState } from "./LivePanel";

export const dynamic = "force-dynamic";

export default async function AdminResultsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();

  const [{ data: matches }, { data: liveRows }, { data: syncRow }] = await Promise.all([
    supabase
      .from("matches")
      .select(
        `*,
         home_team:teams!matches_home_team_id_fkey (*),
         away_team:teams!matches_away_team_id_fkey (*),
         match_results (*)`
      )
      .order("kickoff_at", { ascending: true }),
    supabase.from("live_scores").select("*"),
    supabase.from("live_sync_state").select("*").eq("id", 1).maybeSingle(),
  ]);

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

  const liveByMatch = new Map((liveRows ?? []).map((r: any) => [r.match_id, r]));
  const liveItems: LiveItem[] = (matches ?? []).flatMap((m: any) => {
    const lr = liveByMatch.get(m.id);
    if (!lr) return [];
    const r = Array.isArray(m.match_results) ? m.match_results[0] : m.match_results;
    const team = (t: any) =>
      t ? { code: t.code, nameEs: t.name_es, flagEmoji: t.flag_emoji } : null;
    return [
      {
        matchId: m.id,
        matchNumber: m.match_number,
        homeTeam: team(m.home_team),
        awayTeam: team(m.away_team),
        kickoffAt: m.kickoff_at,
        isVoided: m.is_voided,
        providerKickoffAt: lr.provider_kickoff_at,
        providerHome: lr.provider_home,
        providerAway: lr.provider_away,
        homeScore: lr.home_score,
        awayScore: lr.away_score,
        status: lr.status,
        statusDetail: lr.status_detail,
        displayClock: lr.display_clock,
        completed: lr.completed,
        result: r ? { homeScore: r.home_score, awayScore: r.away_score } : null,
      },
    ];
  });
  const syncState: SyncState | null = syncRow
    ? { lastRunAt: syncRow.last_run_at, ok: syncRow.ok, message: syncRow.message }
    : null;

  return (
    <div className="space-y-3">
      <LivePanel items={liveItems} sync={syncState} />
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
