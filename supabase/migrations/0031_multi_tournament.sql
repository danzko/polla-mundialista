-- ============================================================
-- 0031 Multi-tournament foundation (Sept 2026)
--
-- The app becomes an annual club: the World Cup 2026 is archived as
-- tournament #1 and the 2026-27 Champions League becomes tournament #2,
-- on the same users / leagues / scoring engine.
--
-- What changes:
--   * new `tournaments` table (fixed ids so TS can reference them)
--   * tournament_id on every tournament-scoped table; predictions,
--     bracket_picks, match_results, live_scores derive it via match_id
--   * teams: nullable group columns (clubs have none) + logo_url (crests)
--   * matches: matchday / leg / tie_number for league phase + 2-leg ties;
--     stage enum gains 'league' and 'playoff'
--   * bonus_predictions PK -> (user_id, tournament_id);
--     tournament_outcomes PK -> tournament_id
--   * `bracket_nodes`: the knockout tree + advancement weights as DATA
--     (replaces the three hardcoded WC copies in propagate_bracket,
--     leaderboard_view and leaderboard_total_as_of)
--   * leaderboard_view / leaderboard_matchday gain tournament_id
--   * RLS lock dates read from tournaments instead of literals
-- Existing rows are backfilled to the World Cup; behaviour for WC data is
-- unchanged (verified by the dry-run diff of leaderboard_view).
-- ============================================================

-- ---------- tournaments ----------
create table if not exists public.tournaments (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  kind             text not null check (kind in ('world_cup','ucl')),
  name_en          text not null,
  name_es          text not null,
  status           text not null default 'upcoming' check (status in ('upcoming','active','archived')),
  espn_league      text not null,          -- ESPN scoreboard league slug
  starts_at        timestamptz,
  ends_at          timestamptz,
  picks_lock_at    timestamptz,            -- champion / boot / ball picks lock
  bracket_deadline timestamptz,            -- one-shot bracket entry deadline (null = per-match kickoff lock only)
  created_at       timestamptz not null default now()
);
alter table public.tournaments enable row level security;
drop policy if exists tournaments_select_all on public.tournaments;
create policy tournaments_select_all on public.tournaments for select using (true);
drop policy if exists tournaments_modify_superadmin on public.tournaments;
create policy tournaments_modify_superadmin on public.tournaments for all
  using (public.is_superadmin()) with check (public.is_superadmin());

insert into public.tournaments (id, slug, kind, name_en, name_es, status, espn_league, starts_at, ends_at, picks_lock_at, bracket_deadline)
values
  ('a0000000-0000-4000-8000-000000002026', 'wc-2026', 'world_cup',
   'World Cup 2026', 'Mundial 2026', 'archived', 'fifa.world',
   '2026-06-11 19:00+00', '2026-07-19 23:59+00', '2026-06-11 19:00+00', '2026-06-29 03:59+00'),
  ('a0000000-0000-4000-8000-000000002627', 'ucl-2026-27', 'ucl',
   'Champions League 2026-27', 'Champions League 2026-27', 'upcoming', 'uefa.champions',
   '2026-09-08 16:45+00', '2027-06-05 23:59+00', '2026-10-13 16:45+00', null)
on conflict (slug) do nothing;

-- ---------- stage enum ----------
alter type public.match_stage add value if not exists 'league';
alter type public.match_stage add value if not exists 'playoff';

-- ---------- teams ----------
alter table public.teams add column if not exists tournament_id uuid references public.tournaments(id) on delete cascade;
update public.teams set tournament_id = 'a0000000-0000-4000-8000-000000002026' where tournament_id is null;
alter table public.teams alter column tournament_id set not null;
alter table public.teams alter column "group" drop not null;
alter table public.teams alter column group_position drop not null;
alter table public.teams add column if not exists logo_url text;
drop index if exists public.teams_code_idx;
create unique index if not exists teams_tournament_code_idx on public.teams (tournament_id, code);

-- ---------- matches ----------
alter table public.matches add column if not exists tournament_id uuid references public.tournaments(id) on delete cascade;
update public.matches set tournament_id = 'a0000000-0000-4000-8000-000000002026' where tournament_id is null;
alter table public.matches alter column tournament_id set not null;
alter table public.matches add column if not exists matchday smallint;    -- league phase round (1..8)
alter table public.matches add column if not exists leg smallint;         -- 1 / 2 for two-legged ties
alter table public.matches add column if not exists tie_number smallint;  -- groups the legs of one tie
drop index if exists public.matches_number_idx;
create unique index if not exists matches_tournament_number_idx on public.matches (tournament_id, match_number);
create index if not exists matches_tournament_idx on public.matches (tournament_id);

-- ---------- bonus_predictions ----------
alter table public.bonus_predictions add column if not exists tournament_id uuid references public.tournaments(id) on delete cascade;
update public.bonus_predictions set tournament_id = 'a0000000-0000-4000-8000-000000002026' where tournament_id is null;
alter table public.bonus_predictions alter column tournament_id set not null;
alter table public.bonus_predictions drop constraint if exists bonus_predictions_pkey;
alter table public.bonus_predictions add primary key (user_id, tournament_id);

-- ---------- tournament_outcomes ----------
alter table public.tournament_outcomes add column if not exists tournament_id uuid references public.tournaments(id) on delete cascade;
update public.tournament_outcomes set tournament_id = 'a0000000-0000-4000-8000-000000002026' where tournament_id is null;
alter table public.tournament_outcomes alter column tournament_id set not null;
alter table public.tournament_outcomes drop constraint if exists tournament_outcomes_pkey;
alter table public.tournament_outcomes drop column if exists id;
alter table public.tournament_outcomes add primary key (tournament_id);
insert into public.tournament_outcomes (tournament_id) values ('a0000000-0000-4000-8000-000000002627') on conflict do nothing;

-- ---------- per-user grace tables ----------
alter table public.bracket_deadline_override add column if not exists tournament_id uuid references public.tournaments(id) on delete cascade;
update public.bracket_deadline_override set tournament_id = 'a0000000-0000-4000-8000-000000002026' where tournament_id is null;
alter table public.bracket_deadline_override alter column tournament_id set not null;
alter table public.bracket_deadline_override drop constraint if exists bracket_deadline_override_pkey;
alter table public.bracket_deadline_override add primary key (user_id, tournament_id);

alter table public.bracket_full_unlock add column if not exists tournament_id uuid references public.tournaments(id) on delete cascade;
update public.bracket_full_unlock set tournament_id = 'a0000000-0000-4000-8000-000000002026' where tournament_id is null;
alter table public.bracket_full_unlock alter column tournament_id set not null;
alter table public.bracket_full_unlock drop constraint if exists bracket_full_unlock_pkey;
alter table public.bracket_full_unlock add primary key (user_id, tournament_id);

-- ---------- stats snapshots + sync heartbeat ----------
alter table public.stat_golden_boot add column if not exists tournament_id uuid references public.tournaments(id) on delete cascade;
update public.stat_golden_boot set tournament_id = 'a0000000-0000-4000-8000-000000002026' where tournament_id is null;
alter table public.stat_golden_boot alter column tournament_id set not null;
alter table public.stat_title_odds add column if not exists tournament_id uuid references public.tournaments(id) on delete cascade;
update public.stat_title_odds set tournament_id = 'a0000000-0000-4000-8000-000000002026' where tournament_id is null;
alter table public.stat_title_odds alter column tournament_id set not null;
alter table public.live_sync_state add column if not exists tournament_id uuid references public.tournaments(id) on delete cascade;
update public.live_sync_state set tournament_id = 'a0000000-0000-4000-8000-000000002026' where tournament_id is null;
create unique index if not exists live_sync_state_tournament_idx on public.live_sync_state (tournament_id);

-- ---------- bracket tree as data ----------
create table if not exists public.bracket_nodes (
  tournament_id  uuid not null references public.tournaments(id) on delete cascade,
  match_number   smallint not null,   -- the deciding match of the node (leg 2 for two-legged ties)
  round          text not null,        -- 'r32','r16','qf','sf','third_place','final','playoff'
  home_ref       text not null,        -- 'W74' / 'L101' feed, or a slot label ('2A', '3:A/B/C/D/F', 'S1')
  away_ref       text not null,
  advance_points smallint not null default 0,  -- points for correctly picking this node's advancer
  primary key (tournament_id, match_number)
);
alter table public.bracket_nodes enable row level security;
drop policy if exists bracket_nodes_select_all on public.bracket_nodes;
create policy bracket_nodes_select_all on public.bracket_nodes for select using (true);
drop policy if exists bracket_nodes_modify_superadmin on public.bracket_nodes;
create policy bracket_nodes_modify_superadmin on public.bracket_nodes for all
  using (public.is_superadmin()) with check (public.is_superadmin());

insert into public.bracket_nodes (tournament_id, match_number, round, home_ref, away_ref, advance_points)
select 'a0000000-0000-4000-8000-000000002026', n, r, h, a, w from (values
  (73,'r32','2A','2B',4),(74,'r32','1E','3:A/B/C/D/F',4),(75,'r32','1F','2C',4),(76,'r32','1C','2F',4),
  (77,'r32','1I','3:C/D/F/G/H',4),(78,'r32','2E','2I',4),(79,'r32','1A','3:C/E/F/H/I',4),(80,'r32','1L','3:E/H/I/J/K',4),
  (81,'r32','1D','3:B/E/F/I/J',4),(82,'r32','1G','3:A/E/H/I/J',4),(83,'r32','2K','2L',4),(84,'r32','1H','2J',4),
  (85,'r32','1B','3:E/F/G/I/J',4),(86,'r32','1J','2H',4),(87,'r32','1K','3:D/E/I/J/L',4),(88,'r32','2D','2G',4),
  (89,'r16','W74','W77',8),(90,'r16','W73','W75',8),(91,'r16','W76','W78',8),(92,'r16','W79','W80',8),
  (93,'r16','W83','W84',8),(94,'r16','W81','W82',8),(95,'r16','W86','W88',8),(96,'r16','W85','W87',8),
  (97,'qf','W89','W90',16),(98,'qf','W93','W94',16),(99,'qf','W91','W92',16),(100,'qf','W95','W96',16),
  (101,'sf','W97','W98',30),(102,'sf','W99','W100',30),
  (103,'third_place','L101','L102',0),(104,'final','W101','W102',55)
) as t(n,r,h,a,w)
on conflict do nothing;

-- ---------- functions ----------
-- Bracket entry deadline for a tournament, raised per-user by an override.
create or replace function public.bracket_deadline(p_tournament uuid)
  returns timestamptz language sql stable security definer
  set search_path to 'public','pg_temp' as $$
  select greatest(
    coalesce((select t.bracket_deadline from public.tournaments t where t.id = p_tournament), timestamptz 'infinity'),
    coalesce((select o.deadline from public.bracket_deadline_override o
              where o.user_id = auth.uid() and o.tournament_id = p_tournament), timestamptz '-infinity'));
$$;
-- Zero-arg form kept for the existing RPC call: the active tournament, else the newest.
create or replace function public.bracket_deadline()
  returns timestamptz language sql stable security definer
  set search_path to 'public','pg_temp' as $$
  select public.bracket_deadline((
    select t.id from public.tournaments t
    order by (t.status = 'active') desc, t.starts_at desc nulls last limit 1));
$$;

create or replace function public.bracket_fully_unlocked(p_tournament uuid)
  returns boolean language sql stable security definer
  set search_path to 'public','pg_temp' as $$
  select exists (select 1 from public.bracket_full_unlock u
                 where u.user_id = auth.uid() and u.tournament_id = p_tournament and now() < u.until);
$$;

-- Knockout advancer from the scoreline. Single game: winner on the night.
-- Second leg of a two-legged tie: aggregate with leg 1 (teams swap sides).
-- Level on aggregate / draw: left null for the admin (penalties / away goals rules).
create or replace function public.derive_ko_advancer()
  returns trigger language plpgsql security definer
  set search_path to 'public','pg_temp' as $$
declare m record; l1 record; agg_home int; agg_away int;
begin
  select stage::text, home_team_id, away_team_id, tournament_id, tie_number, leg
    into m from public.matches where id = NEW.match_id;
  if NEW.advanced_team_id is not null or NEW.home_score is null or NEW.away_score is null
     or m.home_team_id is null or m.away_team_id is null
     or m.stage not in ('playoff','r32','r16','qf','sf','third_place','final') then
    return NEW;
  end if;
  if m.leg = 1 then return NEW; end if;  -- nothing is decided after the first leg
  agg_home := NEW.home_score; agg_away := NEW.away_score;
  if m.leg = 2 then
    select mr.home_score, mr.away_score, x.home_team_id into l1
    from public.matches x join public.match_results mr on mr.match_id = x.id
    where x.tournament_id = m.tournament_id and x.tie_number = m.tie_number and x.leg = 1;
    if not found then return NEW; end if;
    -- leg-1 home side is this leg's away side
    agg_home := agg_home + (case when l1.home_team_id = m.home_team_id then l1.home_score else l1.away_score end);
    agg_away := agg_away + (case when l1.home_team_id = m.away_team_id then l1.home_score else l1.away_score end);
  end if;
  if agg_home <> agg_away then
    NEW.advanced_team_id := case when agg_home > agg_away then m.home_team_id else m.away_team_id end;
  end if;
  return NEW;
end $$;

-- Fill downstream bracket slots from recorded advancers, per tournament, from bracket_nodes.
create or replace function public.propagate_bracket()
  returns void language plpgsql security definer
  set search_path to 'public','pg_temp' as $$
begin
  with feed as (
    select n.tournament_id, n.match_number as dst, s.side, substr(s.ref,1,1) as kind, substr(s.ref,2)::int as src
    from public.bracket_nodes n
    cross join lateral (values ('home', n.home_ref), ('away', n.away_ref)) as s(side, ref)
    where s.ref ~ '^[WL][0-9]+$'
  ),
  side_team as (
    select f.tournament_id, f.dst, f.side,
      case when f.kind = 'W' then mr.advanced_team_id
           else case when mr.advanced_team_id = sm.home_team_id then sm.away_team_id
                     when mr.advanced_team_id = sm.away_team_id then sm.home_team_id end
      end as team_id
    from feed f
    join public.matches sm on sm.tournament_id = f.tournament_id and sm.match_number = f.src
    join public.match_results mr on mr.match_id = sm.id
    where mr.advanced_team_id is not null
  ),
  pivoted as (
    select tournament_id, dst,
      (array_agg(team_id) filter (where side = 'home' and team_id is not null))[1] as home_team,
      (array_agg(team_id) filter (where side = 'away' and team_id is not null))[1] as away_team
    from side_team group by tournament_id, dst
  )
  update public.matches d
  set home_team_id = coalesce(d.home_team_id, p.home_team),
      away_team_id = coalesce(d.away_team_id, p.away_team)
  from pivoted p
  where d.tournament_id = p.tournament_id and d.match_number = p.dst
    and ((d.home_team_id is null and p.home_team is not null)
      or (d.away_team_id is null and p.away_team is not null));
end $$;

-- ---------- leaderboard (per tournament) ----------
drop view if exists public.leaderboard_view;
create view public.leaderboard_view as
with s as (
  select p.user_id, m.tournament_id, m.stage,
    case when p.home_score = mr.home_score and p.away_score = mr.away_score then 6
         when sign(p.home_score - p.away_score) = sign(mr.home_score - mr.away_score) then 2
         else 0 end as pts,
    case when p.home_score = mr.home_score and p.away_score = mr.away_score then 'exact'
         when sign(p.home_score - p.away_score) = sign(mr.home_score - mr.away_score) then 'result'
         else 'wrong' end as ptype
  from public.predictions p
  join public.matches m on m.id = p.match_id and m.is_voided = false
  join public.match_results mr on mr.match_id = p.match_id
),
match_agg as (
  select user_id, tournament_id,
    sum(pts)::int as match_points,
    sum(case when stage::text not in ('group','league') then pts else 0 end)::int as ko_score_points,
    sum(case when stage::text in ('group','league') then pts else 0 end)::int as group_score_points,
    count(*) filter (where ptype = 'exact')::int  as exact_count,
    count(*) filter (where ptype = 'result')::int as result_count,
    count(*) filter (where ptype = 'wrong')::int  as wrong_count
  from s group by user_id, tournament_id
),
pred_adv as (
  select distinct bp.user_id, m.tournament_id, n.advance_points as weight, bp.advancer_team_id as team
  from public.bracket_picks bp
  join public.matches m on m.id = bp.match_id
  join public.bracket_nodes n on n.tournament_id = m.tournament_id and n.match_number = m.match_number
  where bp.advancer_team_id is not null and n.advance_points > 0
),
real_adv as (
  select distinct m.tournament_id, n.advance_points as weight, mr.advanced_team_id as team
  from public.match_results mr
  join public.matches m on m.id = mr.match_id
  join public.bracket_nodes n on n.tournament_id = m.tournament_id and n.match_number = m.match_number
  where mr.advanced_team_id is not null and n.advance_points > 0
),
bracket_agg as (
  select pa.user_id, pa.tournament_id, sum(pa.weight)::int as bracket_points
  from pred_adv pa
  join real_adv ra on ra.tournament_id = pa.tournament_id and ra.weight = pa.weight and ra.team = pa.team
  group by pa.user_id, pa.tournament_id
),
picks_agg as (
  select bp.user_id, bp.tournament_id,
    (case when bp.champion_team_id is not null and o.champion_team_id is not null
            and bp.champion_team_id = o.champion_team_id then 50 else 0 end
   + case when bp.top_scorer_name is not null and o.top_scorer_name is not null
            and lower(btrim(bp.top_scorer_name)) = lower(btrim(o.top_scorer_name)) then 25 else 0 end
   + case when bp.best_player_name is not null and o.best_player_name is not null
            and lower(btrim(bp.best_player_name)) = lower(btrim(o.best_player_name)) then 25 else 0 end)::int as pick_points
  from public.bonus_predictions bp
  join public.tournament_outcomes o on o.tournament_id = bp.tournament_id
),
fp as (
  select p.user_id, m.tournament_id, min(p.submitted_at) as first_prediction_at
  from public.predictions p join public.matches m on m.id = p.match_id
  group by p.user_id, m.tournament_id
),
ids as (
  select user_id, tournament_id from match_agg
  union select user_id, tournament_id from bracket_agg
  union select user_id, tournament_id from picks_agg
)
select
  u.id as user_id,
  ids.tournament_id,
  u.display_name,
  (coalesce(ma.match_points,0) + coalesce(ba.bracket_points,0) + coalesce(pk.pick_points,0))::int as total_points,
  coalesce(ma.exact_count,0)  as exact_count,
  coalesce(ma.result_count,0) as result_count,
  coalesce(ma.wrong_count,0)  as wrong_count,
  fp.first_prediction_at,
  coalesce(ma.match_points,0)::int as match_points,
  (coalesce(ba.bracket_points,0) + coalesce(pk.pick_points,0))::int as bonus_points,
  (coalesce(ma.ko_score_points,0) + coalesce(ba.bracket_points,0))::int as knockout_points,
  coalesce(ma.group_score_points,0)::int as group_score_points,
  coalesce(ma.ko_score_points,0)::int    as ko_score_points,
  coalesce(ba.bracket_points,0)::int     as bracket_points,
  coalesce(pk.pick_points,0)::int        as bonus_pick_points
from ids
join public.users u on u.id = ids.user_id
left join match_agg  ma on ma.user_id = ids.user_id and ma.tournament_id = ids.tournament_id
left join bracket_agg ba on ba.user_id = ids.user_id and ba.tournament_id = ids.tournament_id
left join picks_agg  pk on pk.user_id = ids.user_id and pk.tournament_id = ids.tournament_id
left join fp on fp.user_id = ids.user_id and fp.tournament_id = ids.tournament_id;

drop view if exists public.leaderboard_matchday;
create view public.leaderboard_matchday as
with scored as (
  select p.user_id, m.tournament_id, (m.kickoff_at at time zone 'UTC')::date as match_day,
    case when p.home_score = mr.home_score and p.away_score = mr.away_score then 6
         when sign(p.home_score - p.away_score) = sign(mr.home_score - mr.away_score) then 2
         else 0 end as pts
  from public.predictions p
  join public.matches m on m.id = p.match_id and m.is_voided = false
  join public.match_results mr on mr.match_id = p.match_id
),
daily as (
  select user_id, tournament_id, match_day, sum(pts)::int as day_points
  from scored group by user_id, tournament_id, match_day
)
select user_id, tournament_id, match_day,
  sum(day_points) over (partition by user_id, tournament_id order by match_day)::int as cumulative_points
from daily;

-- Total as of a cutoff (rank movement). Optional tournament filter keeps the old call working.
drop function if exists public.leaderboard_total_as_of(timestamptz);
create or replace function public.leaderboard_total_as_of(cutoff timestamptz, p_tournament uuid default null)
  returns table (user_id uuid, total_points int)
  language sql stable security definer
  set search_path to 'public','pg_temp' as $$
  with s as (
    select p.user_id,
      case when p.home_score = mr.home_score and p.away_score = mr.away_score then 6
           when sign(p.home_score - p.away_score) = sign(mr.home_score - mr.away_score) then 2
           else 0 end as pts
    from public.predictions p
    join public.matches m on m.id = p.match_id and m.is_voided = false
      and (p_tournament is null or m.tournament_id = p_tournament)
    join public.match_results mr on mr.match_id = p.match_id and mr.recorded_at < cutoff
  ),
  match_agg as (select s.user_id, sum(s.pts)::int as match_points from s group by s.user_id),
  pred_adv as (
    select distinct bp.user_id, m.tournament_id, n.advance_points as weight, bp.advancer_team_id as team
    from public.bracket_picks bp
    join public.matches m on m.id = bp.match_id and (p_tournament is null or m.tournament_id = p_tournament)
    join public.bracket_nodes n on n.tournament_id = m.tournament_id and n.match_number = m.match_number
    where bp.advancer_team_id is not null and n.advance_points > 0
  ),
  real_adv as (
    select distinct m.tournament_id, n.advance_points as weight, mr.advanced_team_id as team
    from public.match_results mr
    join public.matches m on m.id = mr.match_id
    join public.bracket_nodes n on n.tournament_id = m.tournament_id and n.match_number = m.match_number
    where mr.advanced_team_id is not null and n.advance_points > 0 and mr.recorded_at < cutoff
  ),
  bracket_agg as (
    select pa.user_id, sum(pa.weight)::int as bracket_points
    from pred_adv pa join real_adv ra
      on ra.tournament_id = pa.tournament_id and ra.weight = pa.weight and ra.team = pa.team
    group by pa.user_id
  ),
  ids as (select user_id from match_agg union select user_id from bracket_agg)
  select i.user_id, (coalesce(ma.match_points,0) + coalesce(ba.bracket_points,0))::int
  from ids i
  left join match_agg ma on ma.user_id = i.user_id
  left join bracket_agg ba on ba.user_id = i.user_id;
$$;
revoke all on function public.leaderboard_total_as_of(timestamptz, uuid) from public;
grant execute on function public.leaderboard_total_as_of(timestamptz, uuid) to authenticated, anon;
revoke all on function public.bracket_deadline(uuid) from public;
grant execute on function public.bracket_deadline(uuid) to authenticated, anon;
revoke all on function public.bracket_fully_unlocked(uuid) from public;
grant execute on function public.bracket_fully_unlocked(uuid) to authenticated, anon;

-- ---------- RLS: lock moments from the tournament, not literals ----------
drop policy if exists bonus_insert_own on public.bonus_predictions;
create policy bonus_insert_own on public.bonus_predictions for insert with check (
  user_id = auth.uid() and (
    now() < (select t.picks_lock_at from public.tournaments t where t.id = tournament_id)
    or public.bonus_unlock_active()));
drop policy if exists bonus_update_own on public.bonus_predictions;
create policy bonus_update_own on public.bonus_predictions for update
  using (user_id = auth.uid() and (
    now() < (select t.picks_lock_at from public.tournaments t where t.id = tournament_id)
    or public.bonus_unlock_active()))
  with check (user_id = auth.uid());
drop policy if exists bonus_select_after_start on public.bonus_predictions;
create policy bonus_select_after_start on public.bonus_predictions for select using (
  now() >= (select t.picks_lock_at from public.tournaments t where t.id = tournament_id));

drop policy if exists bracket_insert_own on public.bracket_picks;
create policy bracket_insert_own on public.bracket_picks for insert with check (
  user_id = auth.uid() and exists (
    select 1 from public.matches m
    where m.id = match_id and m.stage::text not in ('group','league') and m.is_voided = false
      and (public.bracket_fully_unlocked(m.tournament_id)
        or now() < least(public.bracket_deadline(m.tournament_id), m.kickoff_at - interval '15 minutes'))));
drop policy if exists bracket_update_own on public.bracket_picks;
create policy bracket_update_own on public.bracket_picks for update
  using (user_id = auth.uid() and exists (
    select 1 from public.matches m
    where m.id = match_id and m.stage::text not in ('group','league') and m.is_voided = false
      and (public.bracket_fully_unlocked(m.tournament_id)
        or now() < least(public.bracket_deadline(m.tournament_id), m.kickoff_at - interval '15 minutes'))))
  with check (user_id = auth.uid() and exists (
    select 1 from public.matches m
    where m.id = match_id and m.stage::text not in ('group','league') and m.is_voided = false
      and (public.bracket_fully_unlocked(m.tournament_id)
        or now() < least(public.bracket_deadline(m.tournament_id), m.kickoff_at - interval '15 minutes'))));
drop policy if exists bracket_select_after_lock on public.bracket_picks;
create policy bracket_select_after_lock on public.bracket_picks for select to authenticated using (
  exists (select 1 from public.matches m
          where m.id = match_id and now() >= public.bracket_deadline(m.tournament_id)));
