-- ============================================================
-- 0012 Reveal predictions at kickoff (June 12, 2026)
-- Applied live via Supabase MCP as: reveal_picks_at_kickoff
--
-- Owner request: under each started/past game, show every contestant's
-- pick. Picks lock 15 minutes before kickoff, so revealing them AT
-- kickoff is competitively safe (nobody can still edit). This adds a
-- SELECT path for any prediction whose match has kicked off, on top of
-- the existing own / after-result / superadmin policies (RLS policies
-- are OR-ed). Writes are unaffected — still governed by the per-match
-- lock policies from migration 0010.
-- ============================================================

drop policy if exists predictions_select_after_kickoff on public.predictions;
create policy predictions_select_after_kickoff on public.predictions
  for select to authenticated using (
    exists (
      select 1 from public.matches m
      where m.id = predictions.match_id
        and now() >= m.kickoff_at
    )
  );
