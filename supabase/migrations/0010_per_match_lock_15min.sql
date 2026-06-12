-- ============================================================
-- 0010 Per-match lock, 15 minutes before kickoff (June 12, 2026)
-- Applied live via Supabase MCP as: per_match_lock_15min
--
-- Community vote (relayed by the owner June 12): group predictions go
-- back to locking PER MATCH, 15 minutes before each kickoff — this
-- supersedes migration 0007's lock-everything-at-tournament-start.
-- No retroactive entries: any match whose lock moment has passed can
-- never be inserted or edited again (the time condition covers both
-- USING and WITH CHECK, so changing match_id to dodge it also fails).
--
-- stage = 'group' keeps knockout score entry closed: knockout points
-- are advancement-based and bracket picks live in their own window
-- before June 28. Tournament picks (bonus_predictions) remain locked
-- at tournament start — untouched here.
--
-- Note: kickoff_at auto-heals from ESPN (live-scores-sync), so if a
-- match is delayed the lock window moves with the real kickoff.
-- ============================================================

drop policy if exists predictions_insert_own on public.predictions;
create policy predictions_insert_own on public.predictions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.is_voided = false
        and m.stage = 'group'
        and now() < m.kickoff_at - interval '15 minutes'
    )
  );

drop policy if exists predictions_update_own on public.predictions;
create policy predictions_update_own on public.predictions
  for update
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.is_voided = false
        and m.stage = 'group'
        and now() < m.kickoff_at - interval '15 minutes'
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.is_voided = false
        and m.stage = 'group'
        and now() < m.kickoff_at - interval '15 minutes'
    )
  );
