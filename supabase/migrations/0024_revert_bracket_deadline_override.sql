-- Revert migration 0023: the per-user deadline override was used once (UMD
-- grace) then cleared; it's no longer needed. Restore bracket_deadline() to the
-- original immutable global constant and drop the override table.
-- Redefine the function FIRST (so it no longer reads the table), then drop it.
create or replace function public.bracket_deadline()
  returns timestamptz
  language sql
  immutable
  set search_path to 'public','pg_temp'
as $function$
  select timestamptz '2026-06-29 03:59:00+00';   -- 11:59 PM ET, Jun 28 2026
$function$;

drop table if exists public.bracket_deadline_override;
