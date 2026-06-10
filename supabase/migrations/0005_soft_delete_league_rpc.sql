-- ============================================================
-- 0005 Soft-delete league RPC (June 10, 2026)
-- Applied live via Supabase MCP as: soft_delete_league_rpc
--
-- Soft-deleting a league via plain UPDATE fails under RLS: the new row
-- (deleted_at set) no longer satisfies the SELECT policy's
-- "deleted_at IS NULL", so the update is rejected for the very admin
-- performing it. Done via SECURITY DEFINER with an explicit admin check,
-- same pattern as lookup_league_by_invite_code.
-- ============================================================
create or replace function public.soft_delete_league(p_league_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.leagues l
    where l.id = p_league_id
      and l.deleted_at is null
      and (l.admin_user_id = auth.uid() or public.is_superadmin())
  ) then
    return false;
  end if;

  update public.leagues set deleted_at = now() where id = p_league_id;
  return true;
end;
$$;

revoke all on function public.soft_delete_league(uuid) from public;
revoke all on function public.soft_delete_league(uuid) from anon;
grant execute on function public.soft_delete_league(uuid) to authenticated;
grant execute on function public.soft_delete_league(uuid) to service_role;
