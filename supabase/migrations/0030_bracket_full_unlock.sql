-- ============================================================
-- 0030 Per-user bracket FULL unlock (July 1, 2026)
--
-- The bracket_deadline_override (0027) only raises the end-of-day deadline
-- term. But a bracket pick also locks at kickoff(M) - 15 min:
--   now() < least(bracket_deadline(), m.kickoff_at - interval '15 minutes').
-- So a deadline override can't reopen a game that has ALREADY kicked off.
--
-- This adds a stronger, still per-user grace: a full unlock that bypasses BOTH
-- terms (deadline AND kickoff) for one user until it expires — letting them
-- edit ANY knockout game, including ones already played. Owner-authorized for
-- specific players (e.g. someone who couldn't log in to fill their bracket).
--
-- Scoped in the DB: bracket_fully_unlocked() reads auth.uid(); empty/expired
-- table = behaves exactly as before for everyone. Mirrored in TS
-- (getBracket / submitBracket) and the client (BracketBoard.matchLocked).
-- ============================================================

create table if not exists public.bracket_full_unlock (
  user_id    uuid primary key references public.users(id) on delete cascade,
  until      timestamptz not null,   -- unlock is active while now() < until
  note       text,
  created_at timestamptz not null default now()
);
-- RLS on, NO policies: invisible to clients; only the SECURITY DEFINER
-- function below reads it (same pattern as bracket_deadline_override).
alter table public.bracket_full_unlock enable row level security;

create or replace function public.bracket_fully_unlocked()
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public','pg_temp'
as $function$
  select exists (
    select 1 from public.bracket_full_unlock u
    where u.user_id = auth.uid() and now() < u.until
  );
$function$;
revoke all on function public.bracket_fully_unlocked() from public;
grant execute on function public.bracket_fully_unlocked() to authenticated, anon;

-- Rewrite the write policies to allow the write when the user is fully
-- unlocked, OR (the existing rule) the per-match lock hasn't passed. The
-- knockout / not-voided guard is kept in both branches.
drop policy if exists bracket_insert_own on public.bracket_picks;
create policy bracket_insert_own on public.bracket_picks
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.stage <> 'group'
        and m.is_voided = false
        and (
          public.bracket_fully_unlocked()
          or now() < least(public.bracket_deadline(), m.kickoff_at - interval '15 minutes')
        )
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
        and (
          public.bracket_fully_unlocked()
          or now() < least(public.bracket_deadline(), m.kickoff_at - interval '15 minutes')
        )
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.stage <> 'group'
        and m.is_voided = false
        and (
          public.bracket_fully_unlocked()
          or now() < least(public.bracket_deadline(), m.kickoff_at - interval '15 minutes')
        )
    )
  );
