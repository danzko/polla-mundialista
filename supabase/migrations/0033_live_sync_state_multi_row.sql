-- ============================================================
-- 0033 live_sync_state: allow one heartbeat row per tournament
--
-- The table was built as a singleton (CHECK (id = 1)). Migration 0031 added
-- tournament_id + a unique index on it, but left the check in place, so the
-- edge function's upsert for the SECOND tournament silently failed its write
-- (the function doesn't check that upsert's error) and /admin kept showing a
-- stale World Cup heartbeat. Drop the singleton check; the unique index on
-- tournament_id is the real constraint now.
-- ============================================================
alter table public.live_sync_state drop constraint if exists live_sync_state_id_check;
alter table public.live_sync_state alter column tournament_id set not null;
