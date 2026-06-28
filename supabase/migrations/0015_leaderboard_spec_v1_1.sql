-- ============================================================
-- 0015 Leaderboard rewritten to docs/wc2026_pool_scoring_spec.md (v1.1)
-- Applied live via Supabase MCP as: 0015_leaderboard_spec_v1_1
--
-- Supersedes the old leaderboard scoring (group 6/2/0 x2 in knockouts +
-- legacy champion-15 / runner-up-10 / third-5 / semifinalist-3 bonuses).
-- New model:
--   match_points    = group 6/2/0  +  KO per-match bonuses (result/exact)
--   bonus_points    = bracket advancement (incl. champion 55) + Boot/Ball 25
--   knockout_points = KO per-match bonuses + bracket advancement (TIEBREAKER)
--   total_points    = match_points + bonus_points
--
-- Group stage: 6 exact / 2 result / 0 wrong, NO knockout multiplier.
-- Knockout advancement (set intersection of predicted vs real advancers):
--   reach R16 = 4/team, QF = 8, SF = 16, FINAL = 30, CHAMPION = 55.
-- Knockout match bonuses: exact R32=2 else 1; result +3 (excluded in R32),
--   winner via match_results.advanced_team_id (penalty-safe).
-- Tournament picks: Golden Boot 25, Golden Ball 25.
-- Group de-weighting dial: multiply group_points by a factor (currently 1).
--
-- Column order preserved (CREATE OR REPLACE rules) with knockout_points
-- appended at the end so existing callers keep working.
-- ============================================================
create or replace view public.leaderboard_view as
with g as (
  select p.user_id,
    case when p.home_score = mr.home_score and p.away_score = mr.away_score then 6
         when sign(p.home_score - p.away_score) = sign(mr.home_score - mr.away_score) then 2
         else 0 end as pts,
    case when p.home_score = mr.home_score and p.away_score = mr.away_score then 'exact'
         when sign(p.home_score - p.away_score) = sign(mr.home_score - mr.away_score) then 'result'
         else 'wrong' end as ptype
  from public.predictions p
  join public.matches m on m.id = p.match_id and m.is_voided = false and m.stage = 'group'
  join public.match_results mr on mr.match_id = p.match_id
),
group_agg as (
  select user_id,
    (sum(pts) * 1)::int as group_points,   -- groupWeight dial here
    count(*) filter (where ptype = 'exact')::int  as exact_count,
    count(*) filter (where ptype = 'result')::int as result_count,
    count(*) filter (where ptype = 'wrong')::int  as wrong_count
  from g group by user_id
),
ko as (
  select p.user_id,
    case when p.home_score = mr.home_score and p.away_score = mr.away_score
         then case when m.stage = 'r32' then 2 else 1 end else 0 end as exact_pts,
    case when m.stage <> 'r32' and mr.advanced_team_id is not null
           and ((p.home_score > p.away_score and m.home_team_id = mr.advanced_team_id)
             or (p.away_score > p.home_score and m.away_team_id = mr.advanced_team_id))
         then 3 else 0 end as result_pts
  from public.predictions p
  join public.matches m on m.id = p.match_id and m.is_voided = false
       and m.stage in ('r32','r16','qf','sf','third_place','final')
  join public.match_results mr on mr.match_id = p.match_id
),
ko_agg as (
  select user_id, sum(exact_pts + result_pts)::int as ko_match_points from ko group by user_id
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
    (case when bp.top_scorer_name is not null and o.top_scorer_name is not null
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
  select user_id from group_agg
  union select user_id from ko_agg
  union select user_id from bracket_agg
  union select user_id from picks_agg
)
select
  u.id as user_id,
  u.display_name,
  (coalesce(ga.group_points,0) + coalesce(ka.ko_match_points,0)
   + coalesce(ba.bracket_points,0) + coalesce(pk.pick_points,0))::int as total_points,
  coalesce(ga.exact_count,0)  as exact_count,
  coalesce(ga.result_count,0) as result_count,
  coalesce(ga.wrong_count,0)  as wrong_count,
  fp.first_prediction_at,
  (coalesce(ga.group_points,0) + coalesce(ka.ko_match_points,0))::int as match_points,
  (coalesce(ba.bracket_points,0) + coalesce(pk.pick_points,0))::int as bonus_points,
  (coalesce(ka.ko_match_points,0) + coalesce(ba.bracket_points,0))::int as knockout_points
from ids
join public.users u on u.id = ids.user_id
left join group_agg  ga on ga.user_id = ids.user_id
left join ko_agg     ka on ka.user_id = ids.user_id
left join bracket_agg ba on ba.user_id = ids.user_id
left join picks_agg  pk on pk.user_id = ids.user_id
left join fp on fp.user_id = ids.user_id;
