-- ============================================================
-- 0020 Deterministic knockout bracket progression (June 28, 2026)
-- Applied live via Supabase MCP as: 0020_bracket_propagation_triggers
--   (propagate_bracket() body shown here includes the 0021 hotfix:
--    array_agg(...)[1] instead of max(uuid), which does not exist.)
--
-- As each knockout result lands, fill the downstream matches with the correct
-- teams in the correct slots, straight from our bracket tree (src/lib/bracket.ts)
-- — independent of ESPN fixture timing. Fill-only; never overwrites a team.
-- ============================================================

-- (a) BEFORE: auto-derive the advancer for a decisive (non-draw) knockout score
-- when it wasn't provided. Draw/penalty results still need advanced_team_id set
-- explicitly (ESPN sync sets it; admin draw-on-pens uses the /admin picker).
create or replace function public.derive_ko_advancer()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare st text; h uuid; a uuid;
begin
  select m.stage::text, m.home_team_id, m.away_team_id into st, h, a
  from public.matches m where m.id = NEW.match_id;
  if st in ('r32','r16','qf','sf','third_place','final')
     and NEW.advanced_team_id is null
     and NEW.home_score is not null and NEW.away_score is not null
     and NEW.home_score <> NEW.away_score
     and h is not null and a is not null then
    NEW.advanced_team_id := case when NEW.home_score > NEW.away_score then h else a end;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_derive_ko_advancer on public.match_results;
create trigger trg_derive_ko_advancer
  before insert or update on public.match_results
  for each row execute function public.derive_ko_advancer();

-- (b) Propagate winners (W) and SF losers (L) into downstream slots, fill-only.
create or replace function public.propagate_bracket()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  with feed(dst, side, kind, src) as (values
    (89,'home','W',74),(89,'away','W',77),
    (90,'home','W',73),(90,'away','W',75),
    (91,'home','W',76),(91,'away','W',78),
    (92,'home','W',79),(92,'away','W',80),
    (93,'home','W',83),(93,'away','W',84),
    (94,'home','W',81),(94,'away','W',82),
    (95,'home','W',86),(95,'away','W',88),
    (96,'home','W',85),(96,'away','W',87),
    (97,'home','W',89),(97,'away','W',90),
    (98,'home','W',93),(98,'away','W',94),
    (99,'home','W',91),(99,'away','W',92),
    (100,'home','W',95),(100,'away','W',96),
    (101,'home','W',97),(101,'away','W',98),
    (102,'home','W',99),(102,'away','W',100),
    (103,'home','L',101),(103,'away','L',102),
    (104,'home','W',101),(104,'away','W',102)
  ),
  side_team as (
    select f.dst, f.side,
      case when f.kind = 'W' then mr.advanced_team_id
           else case when mr.advanced_team_id = sm.home_team_id then sm.away_team_id
                     when mr.advanced_team_id = sm.away_team_id then sm.home_team_id end
      end as team_id
    from feed f
    join public.matches sm on sm.match_number = f.src
    join public.match_results mr on mr.match_id = sm.id
    where mr.advanced_team_id is not null
  ),
  pivoted as (
    select dst,
      (array_agg(team_id) filter (where side = 'home' and team_id is not null))[1] as home_team,
      (array_agg(team_id) filter (where side = 'away' and team_id is not null))[1] as away_team
    from side_team group by dst
  )
  update public.matches d
  set home_team_id = coalesce(d.home_team_id, p.home_team),
      away_team_id = coalesce(d.away_team_id, p.away_team)
  from pivoted p
  where d.match_number = p.dst
    and ((d.home_team_id is null and p.home_team is not null)
      or (d.away_team_id is null and p.away_team is not null));
end $$;

-- (c) AFTER: run propagation once per result-write statement (no recursion:
-- it only writes to matches, not match_results).
create or replace function public.trg_propagate_bracket()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.propagate_bracket();
  return null;
end $$;

drop trigger if exists trg_after_result_propagate on public.match_results;
create trigger trg_after_result_propagate
  after insert or update on public.match_results
  for each statement execute function public.trg_propagate_bracket();
