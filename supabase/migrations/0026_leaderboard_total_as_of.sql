-- Grand total (match scorelines 6/2/0 + bracket advancement) as it stood at a
-- point in time, by filtering results on recorded_at. Powers rank-movement
-- arrows ("how did standings change on the most recent result day") that stay
-- consistent with the live grand-total ranking. Bonus picks resolve only at
-- tournament end (0 during play) so they're omitted — they don't affect
-- in-tournament movement. Uses the CURRENT scoring (6/2/0, no ×2 multiplier).
create or replace function public.leaderboard_total_as_of(cutoff timestamptz)
  returns table(user_id uuid, total_points int)
  language sql
  stable
  security definer
  set search_path to 'public','pg_temp'
as $function$
  with s as (
    select p.user_id,
      case when p.home_score = mr.home_score and p.away_score = mr.away_score then 6
           when sign(p.home_score - p.away_score) = sign(mr.home_score - mr.away_score) then 2
           else 0 end as pts
    from public.predictions p
    join public.matches m on m.id = p.match_id and m.is_voided = false
    join public.match_results mr on mr.match_id = p.match_id and mr.recorded_at < cutoff
  ),
  match_agg as (select s.user_id, sum(s.pts)::int as match_points from s group by s.user_id),
  feeder(match_number, weight) as (
    values (73,4),(74,4),(75,4),(76,4),(77,4),(78,4),(79,4),(80,4),
           (81,4),(82,4),(83,4),(84,4),(85,4),(86,4),(87,4),(88,4),
           (89,8),(90,8),(91,8),(92,8),(93,8),(94,8),(95,8),(96,8),
           (97,16),(98,16),(99,16),(100,16),(101,30),(102,30),(104,55)
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
    where mr.advanced_team_id is not null and mr.recorded_at < cutoff
  ),
  bracket_agg as (
    select pa.user_id, sum(pa.weight)::int as bracket_points
    from pred_adv pa join real_adv ra on ra.weight = pa.weight and ra.team = pa.team
    group by pa.user_id
  ),
  ids as (select user_id from match_agg union select user_id from bracket_agg)
  select i.user_id,
    (coalesce(ma.match_points,0) + coalesce(ba.bracket_points,0))::int as total_points
  from ids i
  left join match_agg ma on ma.user_id = i.user_id
  left join bracket_agg ba on ba.user_id = i.user_id;
$function$;

grant execute on function public.leaderboard_total_as_of(timestamptz) to authenticated, anon;
