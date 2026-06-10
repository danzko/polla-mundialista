-- ============================================================
-- 0003 Launch fixes (June 10, 2026) — applied to the live DB via
-- Supabase MCP as three migrations:
--   * league_lookup_rpc_and_bonus_triples
--   * fix_knockout_kickoff_dates
--   * harden_function_search_paths
-- This file mirrors them for the repo's record.
-- ============================================================

-- ------------------------------------------------------------
-- 1) League lookup RPC.
-- RLS on public.leagues only lets members/creators/superadmin SELECT a
-- league, so joinLeague's "find league by invite code" returned nothing
-- for regular users and every join failed. This SECURITY DEFINER function
-- allows an exact-code lookup (no harvesting: you must know the code),
-- restricted to signed-in users.
-- ------------------------------------------------------------
create or replace function public.lookup_league_by_invite_code(p_code text)
returns table (
  id uuid,
  name text,
  invite_code text,
  language text,
  admin_user_id uuid
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.id, l.name, l.invite_code, l.language::text, l.admin_user_id
  from public.leagues l
  where upper(l.invite_code) = upper(trim(p_code))
    and l.deleted_at is null
  limit 1;
$$;

revoke all on function public.lookup_league_by_invite_code(text) from public;
revoke all on function public.lookup_league_by_invite_code(text) from anon;
grant execute on function public.lookup_league_by_invite_code(text) to authenticated;
grant execute on function public.lookup_league_by_invite_code(text) to service_role;

-- ------------------------------------------------------------
-- 2) Excel-parity bonus picks: 3 ranked top scorers (gold/silver/bronze
-- boot) + 3 ranked best players (gold/silver/bronze ball). The legacy
-- single columns stay and mirror the gold pick.
-- ------------------------------------------------------------
alter table public.bonus_predictions
  add column if not exists top_scorer_names jsonb not null default '[]'::jsonb,
  add column if not exists best_player_names jsonb not null default '[]'::jsonb;

update public.bonus_predictions
   set top_scorer_names = jsonb_build_array(top_scorer_name)
 where coalesce(top_scorer_name, '') <> '' and top_scorer_names = '[]'::jsonb;

update public.bonus_predictions
   set best_player_names = jsonb_build_array(best_player_name)
 where coalesce(best_player_name, '') <> '' and best_player_names = '[]'::jsonb;

-- ------------------------------------------------------------
-- 3) Real knockout kickoff times (UTC), from the pool's Glenfarne Excel
-- (Horarios sheet), consistent with the published FIFA schedule:
-- R32 Jun 28 - Jul 4, R16 Jul 4-7, QF Jul 9-12, SF Jul 14-15,
-- third place Jul 18, final Jul 19. The seed had placeholders.
-- ------------------------------------------------------------
update public.matches set kickoff_at = '2026-06-28 19:00:00+00' where match_number = 73;
update public.matches set kickoff_at = '2026-06-29 17:00:00+00' where match_number = 74;
update public.matches set kickoff_at = '2026-06-29 20:30:00+00' where match_number = 75;
update public.matches set kickoff_at = '2026-06-30 01:00:00+00' where match_number = 76;
update public.matches set kickoff_at = '2026-06-30 17:00:00+00' where match_number = 77;
update public.matches set kickoff_at = '2026-06-30 21:00:00+00' where match_number = 78;
update public.matches set kickoff_at = '2026-07-01 01:00:00+00' where match_number = 79;
update public.matches set kickoff_at = '2026-07-01 16:00:00+00' where match_number = 80;
update public.matches set kickoff_at = '2026-07-01 20:00:00+00' where match_number = 81;
update public.matches set kickoff_at = '2026-07-02 00:00:00+00' where match_number = 82;
update public.matches set kickoff_at = '2026-07-02 19:00:00+00' where match_number = 83;
update public.matches set kickoff_at = '2026-07-02 23:00:00+00' where match_number = 84;
update public.matches set kickoff_at = '2026-07-03 03:00:00+00' where match_number = 85;
update public.matches set kickoff_at = '2026-07-03 18:00:00+00' where match_number = 86;
update public.matches set kickoff_at = '2026-07-03 22:00:00+00' where match_number = 87;
update public.matches set kickoff_at = '2026-07-04 01:30:00+00' where match_number = 88;
update public.matches set kickoff_at = '2026-07-04 17:00:00+00' where match_number = 89;
update public.matches set kickoff_at = '2026-07-04 21:00:00+00' where match_number = 90;
update public.matches set kickoff_at = '2026-07-05 20:00:00+00' where match_number = 91;
update public.matches set kickoff_at = '2026-07-06 00:00:00+00' where match_number = 92;
update public.matches set kickoff_at = '2026-07-06 19:00:00+00' where match_number = 93;
update public.matches set kickoff_at = '2026-07-07 00:00:00+00' where match_number = 94;
update public.matches set kickoff_at = '2026-07-07 16:00:00+00' where match_number = 95;
update public.matches set kickoff_at = '2026-07-07 20:00:00+00' where match_number = 96;
update public.matches set kickoff_at = '2026-07-09 20:00:00+00' where match_number = 97;
update public.matches set kickoff_at = '2026-07-10 19:00:00+00' where match_number = 98;
update public.matches set kickoff_at = '2026-07-11 21:00:00+00' where match_number = 99;
update public.matches set kickoff_at = '2026-07-12 01:00:00+00' where match_number = 100;
update public.matches set kickoff_at = '2026-07-14 19:00:00+00' where match_number = 101;
update public.matches set kickoff_at = '2026-07-15 19:00:00+00' where match_number = 102;
update public.matches set kickoff_at = '2026-07-18 21:00:00+00' where match_number = 103;
update public.matches set kickoff_at = '2026-07-19 19:00:00+00' where match_number = 104;

-- ------------------------------------------------------------
-- 4) Security advisor cleanups: pin search_path on helper functions.
-- is_superadmin / is_league_member must remain executable by
-- anon+authenticated because RLS policies call them.
-- ------------------------------------------------------------
alter function public.is_superadmin() set search_path = public, pg_temp;
alter function public.is_league_member(uuid) set search_path = public, pg_temp;
alter function public.update_updated_at() set search_path = public, pg_temp;

do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    alter function public.rls_auto_enable() set search_path = public, pg_temp;
    revoke all on function public.rls_auto_enable() from public;
    revoke all on function public.rls_auto_enable() from anon;
    revoke all on function public.rls_auto_enable() from authenticated;
  end if;
end $$;
