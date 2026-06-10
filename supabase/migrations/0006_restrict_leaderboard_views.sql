-- ============================================================
-- 0006 Restrict leaderboard views to signed-in users (June 10, 2026)
-- Applied live via Supabase MCP as: restrict_leaderboard_views_to_authenticated
--
-- The two leaderboard views are intentionally SECURITY DEFINER: a
-- leaderboard must aggregate across all users' scored predictions,
-- which RLS otherwise blocks. They expose only display names and
-- point totals (the same content every league member sees in-app).
-- The Supabase advisor flags the DEFINER pattern as CRITICAL
-- generically; the accepted posture + this anon revoke are the
-- mitigation. The pattern itself goes away when leaderboard_view is
-- rebuilt for advancement-based knockout scoring (before June 28).
-- ============================================================
revoke all on public.leaderboard_view from anon;
revoke all on public.leaderboard_view from public;
revoke all on public.leaderboard_matchday from anon;
revoke all on public.leaderboard_matchday from public;
grant select on public.leaderboard_view to authenticated;
grant select on public.leaderboard_view to service_role;
grant select on public.leaderboard_matchday to authenticated;
grant select on public.leaderboard_matchday to service_role;
