-- ============================================================
-- 0004 Fix group-stage kickoff mapping (June 10, 2026)
-- Applied live via Supabase MCP as: fix_group_stage_kickoff_mapping
--
-- The seed read the Excel Horarios GA..GL blocks as sequential
-- six-match blocks; they are per-GROUP blocks [R1a,R1b,R2a,R2b,R3a,R3b].
-- That gave 95 impossible rest gaps (Brazil playing twice in 19h).
-- Corrected mapping validated: 0 sub-72h gaps, R3 simultaneous per
-- group, host openers match reality, first kickoff (and therefore the
-- Jun 11 19:00 UTC bonus lock) unchanged.
-- ============================================================
update public.matches set kickoff_at = '2026-06-11 19:00:00+00' where match_number = 1;
update public.matches set kickoff_at = '2026-06-12 02:00:00+00' where match_number = 2;
update public.matches set kickoff_at = '2026-06-12 19:00:00+00' where match_number = 3;
update public.matches set kickoff_at = '2026-06-13 19:00:00+00' where match_number = 4;
update public.matches set kickoff_at = '2026-06-13 22:00:00+00' where match_number = 5;
update public.matches set kickoff_at = '2026-06-14 01:00:00+00' where match_number = 6;
update public.matches set kickoff_at = '2026-06-13 01:00:00+00' where match_number = 7;
update public.matches set kickoff_at = '2026-06-14 04:00:00+00' where match_number = 8;
update public.matches set kickoff_at = '2026-06-14 17:00:00+00' where match_number = 9;
update public.matches set kickoff_at = '2026-06-14 23:00:00+00' where match_number = 10;
update public.matches set kickoff_at = '2026-06-14 20:00:00+00' where match_number = 11;
update public.matches set kickoff_at = '2026-06-15 02:00:00+00' where match_number = 12;
update public.matches set kickoff_at = '2026-06-15 19:00:00+00' where match_number = 13;
update public.matches set kickoff_at = '2026-06-16 01:00:00+00' where match_number = 14;
update public.matches set kickoff_at = '2026-06-15 16:00:00+00' where match_number = 15;
update public.matches set kickoff_at = '2026-06-15 22:00:00+00' where match_number = 16;
update public.matches set kickoff_at = '2026-06-16 19:00:00+00' where match_number = 17;
update public.matches set kickoff_at = '2026-06-16 22:00:00+00' where match_number = 18;
update public.matches set kickoff_at = '2026-06-17 01:00:00+00' where match_number = 19;
update public.matches set kickoff_at = '2026-06-17 04:00:00+00' where match_number = 20;
update public.matches set kickoff_at = '2026-06-17 17:00:00+00' where match_number = 21;
update public.matches set kickoff_at = '2026-06-18 02:00:00+00' where match_number = 22;
update public.matches set kickoff_at = '2026-06-17 20:00:00+00' where match_number = 23;
update public.matches set kickoff_at = '2026-06-17 23:00:00+00' where match_number = 24;
update public.matches set kickoff_at = '2026-06-18 16:00:00+00' where match_number = 25;
update public.matches set kickoff_at = '2026-06-19 01:00:00+00' where match_number = 26;
update public.matches set kickoff_at = '2026-06-18 19:00:00+00' where match_number = 27;
update public.matches set kickoff_at = '2026-06-18 22:00:00+00' where match_number = 28;
update public.matches set kickoff_at = '2026-06-19 22:00:00+00' where match_number = 29;
update public.matches set kickoff_at = '2026-06-20 00:30:00+00' where match_number = 30;
update public.matches set kickoff_at = '2026-06-19 19:00:00+00' where match_number = 31;
update public.matches set kickoff_at = '2026-06-20 03:00:00+00' where match_number = 32;
update public.matches set kickoff_at = '2026-06-20 20:00:00+00' where match_number = 33;
update public.matches set kickoff_at = '2026-06-21 00:00:00+00' where match_number = 34;
update public.matches set kickoff_at = '2026-06-20 17:00:00+00' where match_number = 35;
update public.matches set kickoff_at = '2026-06-21 04:00:00+00' where match_number = 36;
update public.matches set kickoff_at = '2026-06-21 19:00:00+00' where match_number = 37;
update public.matches set kickoff_at = '2026-06-22 01:00:00+00' where match_number = 38;
update public.matches set kickoff_at = '2026-06-21 16:00:00+00' where match_number = 39;
update public.matches set kickoff_at = '2026-06-21 22:00:00+00' where match_number = 40;
update public.matches set kickoff_at = '2026-06-22 21:00:00+00' where match_number = 41;
update public.matches set kickoff_at = '2026-06-23 00:00:00+00' where match_number = 42;
update public.matches set kickoff_at = '2026-06-22 17:00:00+00' where match_number = 43;
update public.matches set kickoff_at = '2026-06-23 03:00:00+00' where match_number = 44;
update public.matches set kickoff_at = '2026-06-23 17:00:00+00' where match_number = 45;
update public.matches set kickoff_at = '2026-06-24 02:00:00+00' where match_number = 46;
update public.matches set kickoff_at = '2026-06-23 20:00:00+00' where match_number = 47;
update public.matches set kickoff_at = '2026-06-23 23:00:00+00' where match_number = 48;
update public.matches set kickoff_at = '2026-06-25 01:00:00+00' where match_number = 49;
update public.matches set kickoff_at = '2026-06-25 01:00:00+00' where match_number = 50;
update public.matches set kickoff_at = '2026-06-24 19:00:00+00' where match_number = 51;
update public.matches set kickoff_at = '2026-06-24 19:00:00+00' where match_number = 52;
update public.matches set kickoff_at = '2026-06-24 22:00:00+00' where match_number = 53;
update public.matches set kickoff_at = '2026-06-24 22:00:00+00' where match_number = 54;
update public.matches set kickoff_at = '2026-06-26 02:00:00+00' where match_number = 55;
update public.matches set kickoff_at = '2026-06-26 02:00:00+00' where match_number = 56;
update public.matches set kickoff_at = '2026-06-25 20:00:00+00' where match_number = 57;
update public.matches set kickoff_at = '2026-06-25 20:00:00+00' where match_number = 58;
update public.matches set kickoff_at = '2026-06-25 23:00:00+00' where match_number = 59;
update public.matches set kickoff_at = '2026-06-25 23:00:00+00' where match_number = 60;
update public.matches set kickoff_at = '2026-06-27 03:00:00+00' where match_number = 61;
update public.matches set kickoff_at = '2026-06-27 03:00:00+00' where match_number = 62;
update public.matches set kickoff_at = '2026-06-27 00:00:00+00' where match_number = 63;
update public.matches set kickoff_at = '2026-06-27 00:00:00+00' where match_number = 64;
update public.matches set kickoff_at = '2026-06-26 19:00:00+00' where match_number = 65;
update public.matches set kickoff_at = '2026-06-26 19:00:00+00' where match_number = 66;
update public.matches set kickoff_at = '2026-06-28 02:00:00+00' where match_number = 67;
update public.matches set kickoff_at = '2026-06-28 02:00:00+00' where match_number = 68;
update public.matches set kickoff_at = '2026-06-27 23:30:00+00' where match_number = 69;
update public.matches set kickoff_at = '2026-06-27 23:30:00+00' where match_number = 70;
update public.matches set kickoff_at = '2026-06-27 21:00:00+00' where match_number = 71;
update public.matches set kickoff_at = '2026-06-27 21:00:00+00' where match_number = 72;