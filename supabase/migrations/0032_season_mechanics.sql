-- ============================================================
-- 0032 Season mechanics (Sept 2026, owner-approved): La Fija (banker),
-- Jornada winner, Top 8 call, exact-score streak.
--
--   * bankers: one match per (user, tournament, matchday) whose scoreline
--     points DOUBLE (12 / 4 / 0). Movable until that game locks.
--   * top8_picks: the 8 clubs a player says finish top 8 of the league
--     phase (+5 each, +20 for all eight). Locks at tournaments.picks_lock_at.
--     The real top 8 goes in tournament_outcomes.top8_team_ids (admin, Jan).
--   * matchday_points: per (user, tournament, matchday) points incl. banker,
--     plus whether the matchday is complete (every game has a result).
--   * matchday_winners: top scorer(s) of each COMPLETE matchday (+5 each).
--   * leaderboard_view: banker doubling, +5 per jornada win, top-8 points,
--     exact_streak (consecutive exact scores, most recent first).
-- WC data is untouched: no bankers / top-8 rows exist for it.
-- ============================================================

-- ---------- La Fija ----------
create table if not exists public.bankers (
  user_id       uuid not null references public.users(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  matchday      smallint not null,
  match_id      uuid not null references public.matches(id) on delete cascade,
  submitted_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, tournament_id, matchday)
);
create index if not exists bankers_match_idx on public.bankers (match_id);
alter table public.bankers enable row level security;
drop policy if exists bankers_select_own on public.bankers;
create policy bankers_select_own on public.bankers for select using (user_id = auth.uid());
drop policy if exists bankers_select_after_kickoff on public.bankers;
create policy bankers_select_after_kickoff on public.bankers for select to authenticated using (
  exists (select 1 from public.matches m where m.id = match_id and now() >= m.kickoff_at));
drop policy if exists bankers_select_superadmin on public.bankers;
create policy bankers_select_superadmin on public.bankers for select using (public.is_superadmin());
-- The chosen game must belong to that tournament + matchday and still be open.
drop policy if exists bankers_insert_own on public.bankers;
create policy bankers_insert_own on public.bankers for insert with check (
  user_id = auth.uid() and exists (
    select 1 from public.matches m
    where m.id = match_id and m.tournament_id = bankers.tournament_id and m.matchday = bankers.matchday
      and m.is_voided = false and now() < m.kickoff_at - interval '15 minutes'));
-- Movable only while the CURRENT banker game is still open, onto an open game.
drop policy if exists bankers_update_own on public.bankers;
create policy bankers_update_own on public.bankers for update
  using (user_id = auth.uid() and exists (
    select 1 from public.matches m where m.id = match_id and now() < m.kickoff_at - interval '15 minutes'))
  with check (user_id = auth.uid() and exists (
    select 1 from public.matches m
    where m.id = match_id and m.tournament_id = bankers.tournament_id and m.matchday = bankers.matchday
      and m.is_voided = false and now() < m.kickoff_at - interval '15 minutes'));
drop trigger if exists bankers_updated_at on public.bankers;
create trigger bankers_updated_at before update on public.bankers for each row execute function public.update_updated_at();

-- ---------- Top 8 call ----------
alter table public.tournament_outcomes add column if not exists top8_team_ids jsonb;
create table if not exists public.top8_picks (
  user_id       uuid not null references public.users(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_ids      jsonb not null default '[]'::jsonb,   -- up to 8 team uuids
  submitted_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, tournament_id),
  constraint top8_max_eight check (jsonb_array_length(team_ids) <= 8)
);
alter table public.top8_picks enable row level security;
drop policy if exists top8_select_own on public.top8_picks;
create policy top8_select_own on public.top8_picks for select using (user_id = auth.uid());
drop policy if exists top8_select_after_lock on public.top8_picks;
create policy top8_select_after_lock on public.top8_picks for select to authenticated using (
  now() >= (select t.picks_lock_at from public.tournaments t where t.id = tournament_id));
drop policy if exists top8_select_superadmin on public.top8_picks;
create policy top8_select_superadmin on public.top8_picks for select using (public.is_superadmin());
drop policy if exists top8_insert_own on public.top8_picks;
create policy top8_insert_own on public.top8_picks for insert with check (
  user_id = auth.uid() and (
    now() < (select t.picks_lock_at from public.tournaments t where t.id = tournament_id)
    or public.bonus_unlock_active()));
drop policy if exists top8_update_own on public.top8_picks;
create policy top8_update_own on public.top8_picks for update
  using (user_id = auth.uid() and (
    now() < (select t.picks_lock_at from public.tournaments t where t.id = tournament_id)
    or public.bonus_unlock_active()))
  with check (user_id = auth.uid());
drop trigger if exists top8_updated_at on public.top8_picks;
create trigger top8_updated_at before update on public.top8_picks for each row execute function public.update_updated_at();

-- ---------- Per-matchday points ----------
drop view if exists public.leaderboard_matchday;
drop view if exists public.matchday_winners;
drop view if exists public.matchday_points;
create view public.matchday_points as
with s as (
  select p.user_id, m.tournament_id, m.matchday,
    (case when p.home_score = mr.home_score and p.away_score = mr.away_score then 6
          when sign(p.home_score - p.away_score) = sign(mr.home_score - mr.away_score) then 2
          else 0 end) * (case when b.match_id is not null then 2 else 1 end) as pts
  from public.predictions p
  join public.matches m on m.id = p.match_id and m.is_voided = false and m.matchday is not null
  join public.match_results mr on mr.match_id = p.match_id
  left join public.bankers b on b.user_id = p.user_id and b.match_id = p.match_id
),
complete as (
  select m.tournament_id, m.matchday, bool_and(mr.match_id is not null) as complete
  from public.matches m
  left join public.match_results mr on mr.match_id = m.id
  where m.matchday is not null and m.is_voided = false
    and m.home_team_id is not null and m.away_team_id is not null
  group by m.tournament_id, m.matchday
)
select s.user_id, s.tournament_id, s.matchday, sum(s.pts)::int as points, c.complete
from s join complete c on c.tournament_id = s.tournament_id and c.matchday = s.matchday
group by s.user_id, s.tournament_id, s.matchday, c.complete;

create view public.matchday_winners as
select mp.tournament_id, mp.matchday, mp.user_id, mp.points
from public.matchday_points mp
where mp.complete
  and mp.points = (select max(x.points) from public.matchday_points x
                   where x.tournament_id = mp.tournament_id and x.matchday = mp.matchday and x.complete);

-- ---------- Leaderboard ----------
drop view if exists public.leaderboard_view;
create view public.leaderboard_view as
with s as (
  select p.user_id, m.tournament_id, m.stage, m.kickoff_at,
    (case when p.home_score = mr.home_score and p.away_score = mr.away_score then 6
          when sign(p.home_score - p.away_score) = sign(mr.home_score - mr.away_score) then 2
          else 0 end) as base_pts,
    (b.match_id is not null) as is_banker,
    case when p.home_score = mr.home_score and p.away_score = mr.away_score then 'exact'
         when sign(p.home_score - p.away_score) = sign(mr.home_score - mr.away_score) then 'result'
         else 'wrong' end as ptype
  from public.predictions p
  join public.matches m on m.id = p.match_id and m.is_voided = false
  join public.match_results mr on mr.match_id = p.match_id
  left join public.bankers b on b.user_id = p.user_id and b.match_id = p.match_id
),
match_agg as (
  select user_id, tournament_id,
    sum(base_pts * (case when is_banker then 2 else 1 end))::int as match_points,
    sum(case when is_banker then base_pts else 0 end)::int as banker_points,
    sum(case when stage::text not in ('group','league') then base_pts * (case when is_banker then 2 else 1 end) else 0 end)::int as ko_score_points,
    sum(case when stage::text in ('group','league') then base_pts * (case when is_banker then 2 else 1 end) else 0 end)::int as group_score_points,
    count(*) filter (where ptype = 'exact')::int  as exact_count,
    count(*) filter (where ptype = 'result')::int as result_count,
    count(*) filter (where ptype = 'wrong')::int  as wrong_count
  from s group by user_id, tournament_id
),
-- current run of exact scores, most recent scored game first
ranked as (
  select user_id, tournament_id, (ptype = 'exact') as exact,
    row_number() over (partition by user_id, tournament_id order by kickoff_at desc) as rn
  from s
),
first_miss as (
  select user_id, tournament_id, min(rn) as miss_rn from ranked where not exact group by user_id, tournament_id
),
streak as (
  select r.user_id, r.tournament_id,
    count(*) filter (where r.rn < coalesce(fm.miss_rn, 2147483647))::int as exact_streak
  from ranked r left join first_miss fm on fm.user_id = r.user_id and fm.tournament_id = r.tournament_id
  group by r.user_id, r.tournament_id
),
jornadas as (
  select user_id, tournament_id, count(*)::int as jornada_wins
  from public.matchday_winners group by user_id, tournament_id
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
top8 as (
  select tp.user_id, tp.tournament_id,
    (select count(*)::int from jsonb_array_elements_text(tp.team_ids) x
      where o.top8_team_ids is not null and o.top8_team_ids ? x.value) as hits
  from public.top8_picks tp
  join public.tournament_outcomes o on o.tournament_id = tp.tournament_id
),
top8_agg as (
  select user_id, tournament_id, (hits * 5 + case when hits = 8 then 20 else 0 end)::int as top8_points
  from top8
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
  union select user_id, tournament_id from top8_agg
)
select
  u.id as user_id,
  ids.tournament_id,
  u.display_name,
  (coalesce(ma.match_points,0) + coalesce(ba.bracket_points,0) + coalesce(pk.pick_points,0)
   + coalesce(t8.top8_points,0) + coalesce(jw.jornada_wins,0) * 5)::int as total_points,
  coalesce(ma.exact_count,0)  as exact_count,
  coalesce(ma.result_count,0) as result_count,
  coalesce(ma.wrong_count,0)  as wrong_count,
  fp.first_prediction_at,
  coalesce(ma.match_points,0)::int as match_points,
  (coalesce(ba.bracket_points,0) + coalesce(pk.pick_points,0) + coalesce(t8.top8_points,0) + coalesce(jw.jornada_wins,0) * 5)::int as bonus_points,
  (coalesce(ma.ko_score_points,0) + coalesce(ba.bracket_points,0))::int as knockout_points,
  coalesce(ma.group_score_points,0)::int as group_score_points,
  coalesce(ma.ko_score_points,0)::int    as ko_score_points,
  coalesce(ba.bracket_points,0)::int     as bracket_points,
  coalesce(pk.pick_points,0)::int        as bonus_pick_points,
  coalesce(ma.banker_points,0)::int      as banker_points,
  coalesce(jw.jornada_wins,0)::int       as jornada_wins,
  coalesce(t8.top8_points,0)::int        as top8_points,
  coalesce(st.exact_streak,0)::int       as exact_streak
from ids
join public.users u on u.id = ids.user_id
left join match_agg  ma on ma.user_id = ids.user_id and ma.tournament_id = ids.tournament_id
left join bracket_agg ba on ba.user_id = ids.user_id and ba.tournament_id = ids.tournament_id
left join picks_agg  pk on pk.user_id = ids.user_id and pk.tournament_id = ids.tournament_id
left join top8_agg   t8 on t8.user_id = ids.user_id and t8.tournament_id = ids.tournament_id
left join jornadas   jw on jw.user_id = ids.user_id and jw.tournament_id = ids.tournament_id
left join streak     st on st.user_id = ids.user_id and st.tournament_id = ids.tournament_id
left join fp on fp.user_id = ids.user_id and fp.tournament_id = ids.tournament_id;

-- Rank movement helper: include banker doubling so "as of" totals match.
drop function if exists public.leaderboard_total_as_of(timestamptz, uuid);
create or replace function public.leaderboard_total_as_of(cutoff timestamptz, p_tournament uuid default null)
  returns table (user_id uuid, total_points int)
  language sql stable security definer
  set search_path to 'public','pg_temp' as $$
  with s as (
    select p.user_id,
      (case when p.home_score = mr.home_score and p.away_score = mr.away_score then 6
            when sign(p.home_score - p.away_score) = sign(mr.home_score - mr.away_score) then 2
            else 0 end) * (case when b.match_id is not null then 2 else 1 end) as pts
    from public.predictions p
    join public.matches m on m.id = p.match_id and m.is_voided = false
      and (p_tournament is null or m.tournament_id = p_tournament)
    join public.match_results mr on mr.match_id = p.match_id and mr.recorded_at < cutoff
    left join public.bankers b on b.user_id = p.user_id and b.match_id = p.match_id
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

-- ---------- Extra time for the season picks (owner, Sept 7): lock at matchday 3 kickoff ----------
update public.tournaments set picks_lock_at = '2026-10-20 16:45+00' where slug = 'ucl-2026-27';
