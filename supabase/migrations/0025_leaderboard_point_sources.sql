-- Expose the four point SOURCES so the unified leaderboard can show an honest
-- "where points come from" breakdown. Additive only — every existing column
-- (total_points, match_points, bonus_points, knockout_points, counts) is kept
-- with identical meaning. New columns:
--   group_score_points = group-stage scorelines (6/2/0)
--   ko_score_points    = knockout scorelines (6/2/0)
--   bracket_points     = bracket advancement (4/8/16/30/55)
--   bonus_pick_points  = pre-tournament picks (champion 50 + boot 25 + ball 25)
-- total = group_score + ko_score + bracket + bonus_pick.
create or replace view public.leaderboard_view as
with s as (
  select p.user_id, m.stage,
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
  select user_id,
    sum(pts)::int as match_points,
    sum(case when stage <> 'group' then pts else 0 end)::int as ko_score_points,
    sum(case when stage =  'group' then pts else 0 end)::int as group_score_points,
    count(*) filter (where ptype = 'exact')::int  as exact_count,
    count(*) filter (where ptype = 'result')::int as result_count,
    count(*) filter (where ptype = 'wrong')::int  as wrong_count
  from s group by user_id
),
feeder(match_number, weight) as (
  values (73,4),(74,4),(75,4),(76,4),(77,4),(78,4),(79,4),(80,4),
         (81,4),(82,4),(83,4),(84,4),(85,4),(86,4),(87,4),(88,4),
         (89,8),(90,8),(91,8),(92,8),(93,8),(94,8),(95,8),(96,8),
         (97,16),(98,16),(99,16),(100,16),
         (101,30),(102,30),
         (104,55)
),
pred_adv as (
  select distinct bp.user_id, fw.weight, bp.advancer_team_id as team
  from public.bracket_picks bp
  join public.matches m on m.id = bp.match_id
  join feeder fw on fw.match_number = m.match_number
  where bp.advancer_team_id is not null
),
real_adv as (
  select distinct fw.weight, mr.advanced_team_id as team
  from public.match_results mr
  join public.matches m on m.id = mr.match_id
  join feeder fw on fw.match_number = m.match_number
  where mr.advanced_team_id is not null
),
bracket_agg as (
  select pa.user_id, sum(pa.weight)::int as bracket_points
  from pred_adv pa
  join real_adv ra on ra.weight = pa.weight and ra.team = pa.team
  group by pa.user_id
),
picks_agg as (
  select bp.user_id,
    (case when bp.champion_team_id is not null and o.champion_team_id is not null
            and bp.champion_team_id = o.champion_team_id then 50 else 0 end
   + case when bp.top_scorer_name is not null and o.top_scorer_name is not null
            and lower(btrim(bp.top_scorer_name)) = lower(btrim(o.top_scorer_name)) then 25 else 0 end
   + case when bp.best_player_name is not null and o.best_player_name is not null
            and lower(btrim(bp.best_player_name)) = lower(btrim(o.best_player_name)) then 25 else 0 end)::int as pick_points
  from public.bonus_predictions bp
  cross join public.tournament_outcomes o
),
fp as (
  select user_id, min(submitted_at) as first_prediction_at from public.predictions group by user_id
),
ids as (
  select user_id from match_agg
  union select user_id from bracket_agg
  union select user_id from picks_agg
)
select
  u.id as user_id,
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
left join match_agg  ma on ma.user_id = ids.user_id
left join bracket_agg ba on ba.user_id = ids.user_id
left join picks_agg  pk on pk.user_id = ids.user_id
left join fp on fp.user_id = ids.user_id;
