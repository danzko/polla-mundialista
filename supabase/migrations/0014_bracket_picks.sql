-- ============================================================
-- 0014 Knockout bracket picks (June 26, 2026)
-- Applied live via Supabase MCP as: bracket_picks
--
-- One bracket per user: for each knockout match (73–104) they store the
-- team they advance + the score. Participants of later rounds are derived
-- from earlier advancers (bracket tree in src/lib/bracket.ts), so only the
-- advancer + score are persisted. ONE entry window: open after groups end,
-- locks at the first R32 kickoff. match_results gains advanced_team_id so a
-- penalty-shootout winner (a draw on the scoreboard) is recorded for
-- scoring.
-- ============================================================

create table if not exists public.bracket_picks (
  user_id uuid references public.users(id) on delete cascade not null,
  match_id uuid references public.matches(id) on delete cascade not null,
  advancer_team_id uuid references public.teams(id),
  home_score smallint,
  away_score smallint,
  submitted_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  primary key (user_id, match_id),
  constraint bracket_home_range check (home_score is null or (home_score >= 0 and home_score <= 30)),
  constraint bracket_away_range check (away_score is null or (away_score >= 0 and away_score <= 30))
);
create index if not exists bracket_picks_match_idx on public.bracket_picks(match_id);

-- Who actually advanced (covers penalty shootouts where the score is a draw).
alter table public.match_results add column if not exists advanced_team_id uuid references public.teams(id);

-- Bracket lock = first Round-of-32 kickoff. SECURITY DEFINER so the RLS
-- policies don't depend on the caller's access to matches.
create or replace function public.bracket_lock_at()
returns timestamptz
language sql stable security definer
set search_path = public, pg_temp
as $$
  select min(kickoff_at) from public.matches where stage = 'r32';
$$;
revoke all on function public.bracket_lock_at() from public;
grant execute on function public.bracket_lock_at() to authenticated, anon;

alter table public.bracket_picks enable row level security;

-- Read: your own anytime; everyone's once the bracket locks; superadmin.
drop policy if exists bracket_select_own on public.bracket_picks;
create policy bracket_select_own on public.bracket_picks
  for select using (user_id = auth.uid());

drop policy if exists bracket_select_after_lock on public.bracket_picks;
create policy bracket_select_after_lock on public.bracket_picks
  for select to authenticated using (now() >= public.bracket_lock_at());

drop policy if exists bracket_select_superadmin on public.bracket_picks;
create policy bracket_select_superadmin on public.bracket_picks
  for select using (is_superadmin());

-- Write: only your own, only before the lock, only knockout matches.
drop policy if exists bracket_insert_own on public.bracket_picks;
create policy bracket_insert_own on public.bracket_picks
  for insert with check (
    user_id = auth.uid()
    and (public.bracket_lock_at() is null or now() < public.bracket_lock_at())
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.stage <> 'group' and m.is_voided = false
    )
  );

drop policy if exists bracket_update_own on public.bracket_picks;
create policy bracket_update_own on public.bracket_picks
  for update
  using (user_id = auth.uid() and (public.bracket_lock_at() is null or now() < public.bracket_lock_at()))
  with check (user_id = auth.uid() and (public.bracket_lock_at() is null or now() < public.bracket_lock_at()));

revoke all on public.bracket_picks from anon;
grant select, insert, update on public.bracket_picks to authenticated;
