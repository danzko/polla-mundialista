-- ============================================================
-- 0021 Hotfix: propagate_bracket() used max(uuid), which doesn't exist.
-- Applied live via Supabase MCP as: 0021_fix_propagate_bracket_uuid_pivot
--
-- The fix (array_agg(team_id)[1] for the single home/away team) has been folded
-- into 0020's propagate_bracket() body in this repo, so replaying 0020 already
-- yields the correct function. Kept for migration-history continuity.
-- ============================================================
select 1;
