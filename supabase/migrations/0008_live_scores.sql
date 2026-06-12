-- ============================================================
-- 0008 Live scores staging (June 12, 2026)
-- Applied live via Supabase MCP as: live_scores_staging
--
-- ESPN's public scoreboard is the external source of truth for
-- real-time scores, match status and kickoff times. A scheduled
-- Edge Function (live-scores-sync, every 2 min via pg_cron+pg_net)
-- upserts what ESPN reports into live_scores — NEVER directly into
-- match_results. The superadmin confirms staged results into
-- match_results with one tap on /admin (auto-fill, human-confirm).
--
-- live_scores.home_score/away_score are ALWAYS oriented to OUR
-- matches.home_team_id/away_team_id (the sync swaps if ESPN lists
-- the fixture reversed). kickoff_drift_seconds = provider kickoff
-- minus our matches.kickoff_at; non-zero values surface as alerts
-- in the admin panel so fixture times stay accurate.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.live_scores (
  match_id uuid primary key references public.matches(id) on delete cascade,
  provider text not null default 'espn',
  provider_event_id text unique,
  home_score smallint,
  away_score smallint,
  status text not null default 'pre', -- pre | in | post
  status_detail text,                 -- "FT", "Halftime", "Fri, June 12th at 3:00 PM EDT"...
  display_clock text,                 -- "67'"
  completed boolean not null default false,
  provider_kickoff_at timestamptz,
  kickoff_drift_seconds integer,
  provider_home text,
  provider_away text,
  fetched_at timestamptz not null default now(),
  changed_at timestamptz
);

create index if not exists live_scores_status_idx on public.live_scores (status);

-- Single-row heartbeat so the admin panel can show sync health
-- even when no matches are in the window.
create table if not exists public.live_sync_state (
  id smallint primary key default 1 check (id = 1),
  last_run_at timestamptz not null default now(),
  ok boolean not null default true,
  events_seen integer not null default 0,
  matched integer not null default 0,
  unmatched integer not null default 0,
  drift_count integer not null default 0,
  message text
);

alter table public.live_scores enable row level security;
alter table public.live_sync_state enable row level security;

-- Authenticated users may read (admin panel today; user-facing live
-- scores later). Writes happen only through the Edge Function's
-- service-role client — no insert/update/delete policies on purpose.
drop policy if exists live_scores_select_authenticated on public.live_scores;
create policy live_scores_select_authenticated on public.live_scores
  for select to authenticated using (true);

drop policy if exists live_sync_state_select_authenticated on public.live_sync_state;
create policy live_sync_state_select_authenticated on public.live_sync_state
  for select to authenticated using (true);

revoke all on public.live_scores from anon;
revoke all on public.live_sync_state from anon;
revoke insert, update, delete on public.live_scores from authenticated;
revoke insert, update, delete on public.live_sync_state from authenticated;

-- The polling job is scheduled outside this file (anon JWT lives in
-- the job command; key is public but kept out of git):
--   select cron.schedule(
--     'live-scores-sync-2min', '*/2 * * * *',
--     $$ select net.http_post(
--          url := 'https://<project>.supabase.co/functions/v1/live-scores-sync',
--          headers := jsonb_build_object('Content-Type','application/json',
--                                        'Authorization','Bearer <anon key>'),
--          body := '{}'::jsonb, timeout_milliseconds := 15000) $$);
