-- ============================================================
-- 0013 One-time display-name change (June 2026)
-- Applied live via Supabase MCP as: one_time_name_change
--
-- Owner request: let users rename themselves exactly ONCE, from a
-- tucked-away menu. users.name_changed_at records when they used it
-- (null = not yet). change_display_name() is the only rename path:
-- SECURITY DEFINER so it works regardless of column grants, and it
-- refuses a second change. Onboarding still sets the initial name via
-- the normal insert (which leaves name_changed_at null), so the first
-- real rename is the one that gets consumed.
-- ============================================================

alter table public.users add column if not exists name_changed_at timestamptz;

create or replace function public.change_display_name(p_name text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_changed timestamptz;
  v_name text := btrim(p_name);
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if length(v_name) < 2 or length(v_name) > 40 then
    raise exception 'invalid name length';
  end if;
  select name_changed_at into v_changed from public.users where id = v_uid;
  if v_changed is not null then
    raise exception 'name already changed';
  end if;
  update public.users
    set display_name = v_name, name_changed_at = now(), updated_at = now()
    where id = v_uid;
  return v_name;
end;
$$;

revoke all on function public.change_display_name(text) from public;
grant execute on function public.change_display_name(text) to authenticated;
