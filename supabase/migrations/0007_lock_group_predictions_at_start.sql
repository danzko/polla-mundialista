-- ============================================================
-- 0007 Lock all group predictions at tournament start (June 12, 2026)
-- Applied live via Supabase MCP as: lock_group_predictions_at_tournament_start
--
-- Owner rule: every group-stage prediction locks at the tournament's
-- first kickoff (2026-06-11 19:00 UTC) — no entries or edits after the
-- opening whistle. The predictions table only holds group-stage score
-- predictions (knockout bracket picks will live in their own table),
-- so writes are closed outright from that timestamp, at the DB layer.
-- ============================================================
drop policy if exists predictions_insert_own on public.predictions;
create policy predictions_insert_own on public.predictions
  for insert with check (
    user_id = auth.uid()
    and now() < '2026-06-11 19:00:00+00'::timestamptz
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.is_voided = false
    )
  );

drop policy if exists predictions_update_own on public.predictions;
create policy predictions_update_own on public.predictions
  for update
  using (
    user_id = auth.uid()
    and now() < '2026-06-11 19:00:00+00'::timestamptz
  )
  with check (
    user_id = auth.uid()
    and now() < '2026-06-11 19:00:00+00'::timestamptz
  );
