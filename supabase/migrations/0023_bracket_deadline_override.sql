-- Per-user bracket deadline override (admin grace extensions).
-- Lets specific users keep editing their bracket past the global deadline,
-- without changing it for anyone else. Invisible to clients (RLS, no policies);
-- only the SECURITY DEFINER bracket_deadline() reads it.
create table if not exists public.bracket_deadline_override (
  user_id    uuid primary key references public.users(id) on delete cascade,
  deadline   timestamptz not null,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.bracket_deadline_override enable row level security;
-- intentionally NO policies: clients can't see or touch this table.

-- bracket_deadline() now returns each caller's EFFECTIVE deadline: the global
-- base, or their personal override if it's later. auth.uid() resolves to the
-- calling user even under SECURITY DEFINER (it reads the JWT claim).
create or replace function public.bracket_deadline()
  returns timestamptz
  language sql
  stable
  security definer
  set search_path to 'public','pg_temp'
as $function$
  select greatest(
    timestamptz '2026-06-29 03:59:00+00',   -- base: 11:59 PM ET, Jun 28 2026
    coalesce(
      (select o.deadline from public.bracket_deadline_override o where o.user_id = auth.uid()),
      timestamptz '-infinity'
    )
  );
$function$;

grant execute on function public.bracket_deadline() to authenticated, anon;
