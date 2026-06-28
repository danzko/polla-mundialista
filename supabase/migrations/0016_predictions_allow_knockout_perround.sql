-- ============================================================
-- 0016 Per-round knockout score entry
-- Applied live via Supabase MCP as: 0016_predictions_allow_knockout_perround
--
-- Owner decision (June 28): players predict knockout SCORELINES on the real
-- fixtures as each round's teams become known, locking per match 15 min before
-- kickoff — the same machinery as the group stage. The big knockout points
-- (advancement) come from bracket_picks; these predictions score only the
-- small match bonuses (R32 exact +2; R16+ result +3 & exact +1).
--
-- Supersedes 0010's stage='group' gate. New rule: a prediction is allowed for
-- ANY non-voided match whose BOTH teams are assigned and whose 15-min lock has
-- not passed. Group matches always have both teams, so their behaviour is
-- unchanged; knockout matches open only once their participants are set
-- (auto-assigned from results), giving the natural round-by-round window.
-- The time + team conditions cover USING and WITH CHECK, so changing match_id
-- to dodge them also fails. No retroactive entries.
-- ============================================================
drop policy if exists predictions_insert_own on public.predictions;
create policy predictions_insert_own on public.predictions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.is_voided = false
        and m.home_team_id is not null
        and m.away_team_id is not null
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
        and m.home_team_id is not null
        and m.away_team_id is not null
        and now() < m.kickoff_at - interval '15 minutes'
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.is_voided = false
        and m.home_team_id is not null
        and m.away_team_id is not null
        and now() < m.kickoff_at - interval '15 minutes'
    )
  );
