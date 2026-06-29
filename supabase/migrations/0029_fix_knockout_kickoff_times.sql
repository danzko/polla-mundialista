-- 0029_fix_knockout_kickoff_times.sql
--
-- Memorialize the June 29 2026 production hotfix.
--
-- Knockout kickoff_at values had been assigned to the WRONG matches: the times
-- were permuted WITHIN each day's slots (e.g. BRA v JPN held the 9pm slot while
-- the real game was at 1pm). Because the live-scores-sync edge function binds
-- ESPN events to our matches by kickoff time when teams are still TBD (and the
-- binding is sticky by provider_event_id), the live Brazil score displayed under
-- the Germany match and the wrong games appeared to lock at the wrong time.
--
-- These are the kickoffs verified against ESPN's official scoreboard
-- (site.api.espn.com fifa.world) on 2026-06-29: R32 mapped by team-pair, R16 by
-- bracket feed-set. QF/SF/3rd/Final were already correct and are re-asserted
-- here for completeness so a fresh re-seed cannot reintroduce the shuffle.
-- Only kickoff_at changes — teams, bracket tree, and scoring are untouched.

update public.matches as m set kickoff_at = v.kickoff
from (values
  -- Round of 32 (73-88)
  (73,  timestamptz '2026-06-28 19:00:00+00'),  -- RSA v CAN
  (74,  timestamptz '2026-06-29 20:30:00+00'),  -- GER v PAR
  (75,  timestamptz '2026-06-30 01:00:00+00'),  -- NED v MAR
  (76,  timestamptz '2026-06-29 17:00:00+00'),  -- BRA v JPN
  (77,  timestamptz '2026-06-30 21:00:00+00'),  -- FRA v SWE
  (78,  timestamptz '2026-06-30 17:00:00+00'),  -- CIV v NOR
  (79,  timestamptz '2026-07-01 01:00:00+00'),  -- MEX v ECU
  (80,  timestamptz '2026-07-01 16:00:00+00'),  -- ENG v COD
  (81,  timestamptz '2026-07-02 00:00:00+00'),  -- USA v BIH
  (82,  timestamptz '2026-07-01 20:00:00+00'),  -- BEL v SEN
  (83,  timestamptz '2026-07-02 23:00:00+00'),  -- POR v CRO
  (84,  timestamptz '2026-07-02 19:00:00+00'),  -- ESP v AUT
  (85,  timestamptz '2026-07-03 03:00:00+00'),  -- SUI v ALG
  (86,  timestamptz '2026-07-03 22:00:00+00'),  -- ARG v CPV
  (87,  timestamptz '2026-07-04 01:30:00+00'),  -- COL v GHA
  (88,  timestamptz '2026-07-03 18:00:00+00'),  -- AUS v EGY
  -- Round of 16 (89-96) — 89/90 were transposed; 91-96 already correct
  (89,  timestamptz '2026-07-04 21:00:00+00'),  -- W74 v W77
  (90,  timestamptz '2026-07-04 17:00:00+00'),  -- W73 v W75 (Canada)
  (91,  timestamptz '2026-07-05 20:00:00+00'),
  (92,  timestamptz '2026-07-06 00:00:00+00'),
  (93,  timestamptz '2026-07-06 19:00:00+00'),
  (94,  timestamptz '2026-07-07 00:00:00+00'),
  (95,  timestamptz '2026-07-07 16:00:00+00'),
  (96,  timestamptz '2026-07-07 20:00:00+00'),
  -- Quarterfinals / Semifinals / 3rd place / Final (97-104) — re-asserted
  (97,  timestamptz '2026-07-09 20:00:00+00'),
  (98,  timestamptz '2026-07-10 19:00:00+00'),
  (99,  timestamptz '2026-07-11 21:00:00+00'),
  (100, timestamptz '2026-07-12 01:00:00+00'),
  (101, timestamptz '2026-07-14 19:00:00+00'),
  (102, timestamptz '2026-07-15 19:00:00+00'),
  (103, timestamptz '2026-07-18 21:00:00+00'),  -- 3rd place
  (104, timestamptz '2026-07-19 19:00:00+00')   -- Final
) as v(match_number, kickoff)
where m.match_number = v.match_number
  and m.kickoff_at is distinct from v.kickoff;
