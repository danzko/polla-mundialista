-- ============================================================
-- 0017 Per-match bracket lock (June 28, 2026)
-- Applied live via Supabase MCP as: 0017_bracket_per_match_lock
--
-- Owner decision: the advancer bracket stays open until an end-of-day
-- deadline so people have more time to fill it — EXCEPT any game that kicks
-- off before then. A pick for match M locks at
--   least(bracket_deadline(), kickoff(M) - 15 min).
-- Match 73 (first R32, 3:00pm ET today) therefore locks at 2:45pm ET; every
-- other knockout pick (R32 games Jun 29+, R16->Final) locks at the deadline.
-- Supersedes 0014's single lock at first R32 kickoff. Integrity preserved:
-- an advancer can never be set after that game has kicked off.
-- Deadline mirrored in TS as BRACKET_ENTRY_DEADLINE_ISO (src/lib/tournament.ts).
-- ============================================================

create or replace function public.bracket_deadline()
returns timestamptz
language sql immutable
set search_path = public, pg_temp
as $$
  select timestamptz '2026-06-29 03:59:00+00';   -- 11:59 PM ET, Jun 28 2026
$$;
revoke all on function public.bracket_deadline() from public;
grant execute on function public.bracket_deadline() to authenticated, anon;

-- Reveal everyone's bracket once it is fully locked (the deadline), not at the
-- first R32 kickoff — picks stay editable until then.
drop policy if exists bracket_select_after_lock on public.bracket_picks;
create policy bracket_select_after_lock on public.bracket_picks
  for select to authenticated using (now() >= public.bracket_deadline());

-- Write: only your own, only a knockout match that is not voided, only while
-- that match's per-match lock has not passed.
drop policy if exists bracket_insert_own on public.bracket_picks;
create policy bracket_insert_own on public.bracket_picks
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.stage <> 'group'
        and m.is_voided = false
        and now() < least(public.bracket_deadline(), m.kickoff_at - interval '15 minutes')
    )
  );

drop policy if exists bracket_update_own on public.bracket_picks;
create policy bracket_update_own on public.bracket_picks
  for update
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.stage <> 'group'
        and m.is_voided = false
        and now() < least(public.bracket_deadline(), m.kickoff_at - interval '15 minutes')
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.stage <> 'group'
        and m.is_voided = false
        and now() < least(public.bracket_deadline(), m.kickoff_at - interval '15 minutes')
    )
  );
