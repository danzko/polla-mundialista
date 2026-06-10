-- 0002: Bonus scoring + leaderboard enhancements
--
-- Adds:
--   1. tournament_outcomes  -- singleton table holding the actual end-of-tournament
--      results (champion, runner-up, third, semifinalists) that bonus picks score against.
--   2. leaderboard_view     -- rewritten to expose match_points, bonus_points, and a
--      total_points that includes bonuses. Existing columns are preserved.
--   3. leaderboard_matchday -- per user, per day cumulative match points, for the
--      standings race chart.
--
-- Notes:
--   - Team bonuses are scored here (champion 15, runner-up 10, third 5, semifinalists
--     3 each). Golden Boot / Golden Ball scoring is deferred until the 3-scorers /
--     3-players schema + autocomplete change lands.
--   - This is a no-op for points until a superadmin fills tournament_outcomes, so it is
--     safe to ship before launch.

-- ============================================================
-- tournament_outcomes (singleton)
-- ============================================================

CREATE TABLE IF NOT EXISTS tournament_outcomes (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  champion_team_id UUID REFERENCES teams(id),
  runner_up_team_id UUID REFERENCES teams(id),
  third_place_team_id UUID REFERENCES teams(id),
  semifinalist_team_ids JSONB,        -- array of up to 4 team UUIDs
  top_scorer_name TEXT,
  best_player_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id),
  CONSTRAINT tournament_outcomes_singleton CHECK (id)
);

INSERT INTO tournament_outcomes (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

ALTER TABLE tournament_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outcomes_select_all" ON tournament_outcomes;
CREATE POLICY "outcomes_select_all"
  ON tournament_outcomes FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "outcomes_modify_superadmin" ON tournament_outcomes;
CREATE POLICY "outcomes_modify_superadmin"
  ON tournament_outcomes FOR ALL
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

GRANT SELECT ON tournament_outcomes TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON tournament_outcomes TO authenticated, service_role;

-- ============================================================
-- leaderboard_view (rewritten: match + bonus)
-- ============================================================

DROP VIEW IF EXISTS leaderboard_view;

CREATE VIEW leaderboard_view AS
WITH scored AS (
  SELECT
    p.user_id,
    CASE
      WHEN p.home_score = mr.home_score AND p.away_score = mr.away_score THEN 6
      WHEN (p.home_score > p.away_score AND mr.home_score > mr.away_score)
        OR (p.home_score < p.away_score AND mr.home_score < mr.away_score)
        OR (p.home_score = p.away_score AND mr.home_score = mr.away_score) THEN 2
      ELSE 0
    END AS base_points,
    CASE WHEN m.stage IN ('r32','r16','qf','sf','third_place','final') THEN 2 ELSE 1 END AS mult,
    CASE
      WHEN p.home_score = mr.home_score AND p.away_score = mr.away_score THEN 'exact'
      WHEN (p.home_score > p.away_score AND mr.home_score > mr.away_score)
        OR (p.home_score < p.away_score AND mr.home_score < mr.away_score)
        OR (p.home_score = p.away_score AND mr.home_score = mr.away_score) THEN 'result'
      ELSE 'wrong'
    END AS ptype
  FROM predictions p
  JOIN matches m ON m.id = p.match_id AND m.is_voided = FALSE
  JOIN match_results mr ON mr.match_id = p.match_id
),
match_agg AS (
  SELECT
    user_id,
    SUM(base_points * mult)::INT AS match_points,
    COUNT(*) FILTER (WHERE ptype = 'exact')::INT AS exact_count,
    COUNT(*) FILTER (WHERE ptype = 'result')::INT AS result_count,
    COUNT(*) FILTER (WHERE ptype = 'wrong')::INT AS wrong_count
  FROM scored
  GROUP BY user_id
),
firstpred AS (
  SELECT user_id, MIN(submitted_at) AS first_prediction_at
  FROM predictions
  GROUP BY user_id
),
bonus_agg AS (
  SELECT
    bp.user_id,
    (
      (CASE WHEN bp.champion_team_id IS NOT NULL AND bp.champion_team_id = o.champion_team_id THEN 15 ELSE 0 END)
      + (CASE WHEN bp.runner_up_team_id IS NOT NULL AND bp.runner_up_team_id = o.runner_up_team_id THEN 10 ELSE 0 END)
      + (CASE WHEN bp.third_place_team_id IS NOT NULL AND bp.third_place_team_id = o.third_place_team_id THEN 5 ELSE 0 END)
      + COALESCE((
          SELECT COUNT(*) * 3
          FROM jsonb_array_elements_text(COALESCE(bp.semifinalists, '[]'::jsonb)) AS s(tid)
          WHERE o.semifinalist_team_ids IS NOT NULL
            AND s.tid IN (SELECT jsonb_array_elements_text(o.semifinalist_team_ids))
        ), 0)
    )::INT AS bonus_points
  FROM bonus_predictions bp
  CROSS JOIN tournament_outcomes o
)
SELECT
  ma.user_id,
  u.display_name,
  (ma.match_points + COALESCE(ba.bonus_points, 0))::INT AS total_points,
  ma.exact_count,
  ma.result_count,
  ma.wrong_count,
  fp.first_prediction_at,
  ma.match_points,
  COALESCE(ba.bonus_points, 0)::INT AS bonus_points
FROM match_agg ma
JOIN users u ON u.id = ma.user_id
LEFT JOIN firstpred fp ON fp.user_id = ma.user_id
LEFT JOIN bonus_agg ba ON ba.user_id = ma.user_id;

GRANT SELECT ON leaderboard_view TO anon, authenticated, service_role;

-- ============================================================
-- leaderboard_matchday (cumulative match points per day)
-- ============================================================

CREATE OR REPLACE VIEW leaderboard_matchday AS
WITH scored AS (
  SELECT
    p.user_id,
    (m.kickoff_at AT TIME ZONE 'UTC')::DATE AS match_day,
    (CASE
      WHEN p.home_score = mr.home_score AND p.away_score = mr.away_score THEN 6
      WHEN (p.home_score > p.away_score AND mr.home_score > mr.away_score)
        OR (p.home_score < p.away_score AND mr.home_score < mr.away_score)
        OR (p.home_score = p.away_score AND mr.home_score = mr.away_score) THEN 2
      ELSE 0
    END) * (CASE WHEN m.stage IN ('r32','r16','qf','sf','third_place','final') THEN 2 ELSE 1 END) AS pts
  FROM predictions p
  JOIN matches m ON m.id = p.match_id AND m.is_voided = FALSE
  JOIN match_results mr ON mr.match_id = p.match_id
),
daily AS (
  SELECT user_id, match_day, SUM(pts)::INT AS day_points
  FROM scored
  GROUP BY user_id, match_day
)
SELECT
  user_id,
  match_day,
  SUM(day_points) OVER (PARTITION BY user_id ORDER BY match_day)::INT AS cumulative_points
FROM daily;

GRANT SELECT ON leaderboard_matchday TO anon, authenticated, service_role;
