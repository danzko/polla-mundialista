-- ============================================================
-- 0011 Per-user bonus re-open window + users write hardening
-- (June 12, 2026; applied live via Supabase MCP as: bonus_unlock_window)
--
-- Owner request: let a specific late-joining user enter the three
-- tournament picks for a limited window. users.bonus_unlock_until
-- holds a per-user expiry; while now() < that timestamp the bonus
-- insert/update policies accept that user, then the lock re-applies
-- by itself. The superadmin sets it via SQL/admin tooling only.
--
-- CRITICAL hardening found while adding the column: the table-wide
-- INSERT/UPDATE grants on public.users let ANY authenticated user set
-- is_superadmin = true on their own row (the RLS policy only checks
-- id = auth.uid(); RLS does not restrict columns). Writes are now
-- column-scoped to exactly what onboarding uses, which also protects
-- bonus_unlock_until from self-service.
-- ============================================================

alter table public.users add column if not exists bonus_unlock_until timestamptz;

revoke insert, update on public.users from authenticated;
revoke insert, update, delete on public.users from anon;
grant insert (id, display_name, preferred_language, updated_at) on public.users to authenticated;
grant update (display_name, preferred_language, updated_at) on public.users to authenticated;

-- SECURITY DEFINER so the bonus policies can read the caller's window
-- without depending on users-table RLS (same pattern as is_superadmin).
create or replace function public.bonus_unlock_active()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select u.bonus_unlock_until > now() from public.users u where u.id = auth.uid()),
    false
  );
$$;
revoke all on function public.bonus_unlock_active() from public;
grant execute on function public.bonus_unlock_active() to authenticated, anon;

drop policy if exists bonus_insert_own on public.bonus_predictions;
create policy bonus_insert_own on public.bonus_predictions
  for insert with check (
    user_id = auth.uid()
    and (
      now() < '2026-06-11 19:00:00+00'::timestamptz
      or public.bonus_unlock_active()
    )
  );

drop policy if exists bonus_update_own on public.bonus_predictions;
create policy bonus_update_own on public.bonus_predictions
  for update
  using (
    user_id = auth.uid()
    and (
      now() < '2026-06-11 19:00:00+00'::timestamptz
      or public.bonus_unlock_active()
    )
  )
  with check (user_id = auth.uid());
