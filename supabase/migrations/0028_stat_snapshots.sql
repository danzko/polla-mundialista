-- Editable snapshots for the Statistics tab's "outside data" overlay: the live
-- Golden Boot race and Vegas title odds. Populated on request (service role);
-- the tab works from our own pick data even when these are empty. Readable by
-- any signed-in user; only service role writes (no write policy needed).
create table if not exists public.stat_golden_boot (
  rank        int primary key,
  player_name text not null,
  team_code   text,
  goals       int,
  photo_url   text,
  updated_at  timestamptz not null default now()
);
create table if not exists public.stat_title_odds (
  rank        int primary key,
  team_code   text not null,
  odds        text,        -- American odds as shown, e.g. '+280'
  implied_pct int,         -- implied probability, e.g. 26
  updated_at  timestamptz not null default now()
);
alter table public.stat_golden_boot enable row level security;
alter table public.stat_title_odds  enable row level security;
create policy stat_boot_read on public.stat_golden_boot for select to authenticated using (true);
create policy stat_odds_read on public.stat_title_odds  for select to authenticated using (true);
