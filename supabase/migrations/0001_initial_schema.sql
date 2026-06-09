-- Polla Mundialista 2026 - Initial Schema + RLS Policies
-- Run against Supabase Postgres via: supabase db push
-- Or apply via Drizzle: npx drizzle-kit push

-- ============================================================
-- Enums
-- ============================================================

CREATE TYPE match_stage AS ENUM (
  'group', 'r32', 'r16', 'qf', 'sf', 'third_place', 'final'
);

CREATE TYPE language AS ENUM ('es', 'en');

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  preferred_language language NOT NULL DEFAULT 'es',
  is_superadmin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_es TEXT NOT NULL,
  flag_emoji TEXT NOT NULL DEFAULT '',
  "group" TEXT NOT NULL,
  group_position SMALLINT NOT NULL,
  eliminated BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX teams_code_idx ON teams(code);

CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_number SMALLINT NOT NULL,
  home_team_id UUID REFERENCES teams(id),
  away_team_id UUID REFERENCES teams(id),
  kickoff_at TIMESTAMPTZ NOT NULL,
  stage match_stage NOT NULL,
  group_label TEXT,
  venue TEXT,
  is_voided BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX matches_number_idx ON matches(match_number);
CREATE INDEX matches_kickoff_idx ON matches(kickoff_at);
CREATE INDEX matches_stage_idx ON matches(stage);

CREATE TABLE match_results (
  match_id UUID PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  home_score SMALLINT NOT NULL,
  away_score SMALLINT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID NOT NULL REFERENCES users(id)
);

CREATE TABLE leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL,
  language language NOT NULL DEFAULT 'es',
  created_by UUID NOT NULL REFERENCES users(id),
  admin_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX leagues_invite_code_idx ON leagues(invite_code);

CREATE TABLE league_members (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, user_id)
);
CREATE INDEX league_members_user_idx ON league_members(user_id);

CREATE TABLE predictions (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  home_score SMALLINT NOT NULL CHECK (home_score >= 0 AND home_score <= 15),
  away_score SMALLINT NOT NULL CHECK (away_score >= 0 AND away_score <= 15),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, match_id)
);
CREATE INDEX predictions_match_idx ON predictions(match_id);

CREATE TABLE bonus_predictions (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  champion_team_id UUID REFERENCES teams(id),
  runner_up_team_id UUID REFERENCES teams(id),
  third_place_team_id UUID REFERENCES teams(id),
  semifinalists JSONB, -- array of 4 team UUIDs
  top_scorer_name TEXT,
  best_player_name TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Helper function: check if current user is superadmin
-- ============================================================

CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND is_superadmin = TRUE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Helper function: check if current user is member of a league
-- ============================================================

CREATE OR REPLACE FUNCTION is_league_member(league_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM league_members
    WHERE league_id = league_uuid AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- RLS Policies
-- ============================================================

-- ---- users ----
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own"
  ON users FOR SELECT
  USING (id = auth.uid() OR is_superadmin());

CREATE POLICY "users_select_public"
  ON users FOR SELECT
  USING (TRUE); -- display_name + language are public to authenticated users
  -- Note: app layer controls which columns to expose

CREATE POLICY "users_insert_own"
  ON users FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ---- teams ----
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams_select_all"
  ON teams FOR SELECT
  USING (TRUE); -- public read for all authenticated users

CREATE POLICY "teams_modify_superadmin"
  ON teams FOR ALL
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- ---- matches ----
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matches_select_all"
  ON matches FOR SELECT
  USING (TRUE);

CREATE POLICY "matches_modify_superadmin"
  ON matches FOR ALL
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- ---- match_results ----
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_results_select_all"
  ON match_results FOR SELECT
  USING (TRUE);

CREATE POLICY "match_results_modify_superadmin"
  ON match_results FOR ALL
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- ---- leagues ----
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leagues_select_member"
  ON leagues FOR SELECT
  USING (
    deleted_at IS NULL
    AND (is_league_member(id) OR is_superadmin())
  );

CREATE POLICY "leagues_insert_authenticated"
  ON leagues FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "leagues_update_admin"
  ON leagues FOR UPDATE
  USING (admin_user_id = auth.uid() OR is_superadmin())
  WITH CHECK (admin_user_id = auth.uid() OR is_superadmin());

CREATE POLICY "leagues_delete_admin"
  ON leagues FOR DELETE
  USING (admin_user_id = auth.uid() OR is_superadmin());

-- ---- league_members ----
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "league_members_select"
  ON league_members FOR SELECT
  USING (is_league_member(league_id) OR is_superadmin());

CREATE POLICY "league_members_insert_self"
  ON league_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "league_members_delete"
  ON league_members FOR DELETE
  USING (
    user_id = auth.uid()  -- leave
    OR EXISTS (            -- admin kick
      SELECT 1 FROM leagues
      WHERE id = league_id AND admin_user_id = auth.uid()
    )
    OR is_superadmin()
  );

-- ---- predictions ----
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- Users can always read their own predictions
CREATE POLICY "predictions_select_own"
  ON predictions FOR SELECT
  USING (user_id = auth.uid());

-- Users can read others' predictions only AFTER match result is recorded
CREATE POLICY "predictions_select_after_result"
  ON predictions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM match_results WHERE match_id = predictions.match_id
    )
  );

-- Superadmin reads all
CREATE POLICY "predictions_select_superadmin"
  ON predictions FOR SELECT
  USING (is_superadmin());

-- Users can insert their own predictions for future, non-voided matches
CREATE POLICY "predictions_insert_own"
  ON predictions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE id = match_id
        AND kickoff_at > now()
        AND is_voided = FALSE
    )
  );

-- Users can update their own predictions for future, non-voided matches
CREATE POLICY "predictions_update_own"
  ON predictions FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE id = match_id
        AND kickoff_at > now()
        AND is_voided = FALSE
    )
  )
  WITH CHECK (user_id = auth.uid());

-- ---- bonus_predictions ----
ALTER TABLE bonus_predictions ENABLE ROW LEVEL SECURITY;

-- Tournament start: first match kickoff. Hardcoded for simplicity.
-- June 11, 2026 19:00 UTC (first match: Mexico vs South Africa at 3pm ET)
-- Adjust if FIFA changes the schedule.

CREATE POLICY "bonus_select_own"
  ON bonus_predictions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "bonus_select_after_start"
  ON bonus_predictions FOR SELECT
  USING (now() >= '2026-06-11T19:00:00Z'::timestamptz);

CREATE POLICY "bonus_select_superadmin"
  ON bonus_predictions FOR SELECT
  USING (is_superadmin());

CREATE POLICY "bonus_insert_own"
  ON bonus_predictions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND now() < '2026-06-11T19:00:00Z'::timestamptz
  );

CREATE POLICY "bonus_update_own"
  ON bonus_predictions FOR UPDATE
  USING (
    user_id = auth.uid()
    AND now() < '2026-06-11T19:00:00Z'::timestamptz
  )
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Leaderboard View (computed scoring, no materialization)
-- ============================================================

CREATE OR REPLACE VIEW leaderboard_view AS
WITH match_points AS (
  SELECT
    p.user_id,
    p.match_id,
    m.stage,
    -- Scoring: 6 exact, 2 correct result, 0 wrong
    CASE
      WHEN p.home_score = mr.home_score AND p.away_score = mr.away_score
        THEN 6  -- exact score
      WHEN (
        (p.home_score > p.away_score AND mr.home_score > mr.away_score) OR
        (p.home_score < p.away_score AND mr.home_score < mr.away_score) OR
        (p.home_score = p.away_score AND mr.home_score = mr.away_score)
      )
        THEN 2  -- correct result
      ELSE 0
    END AS base_points,
    -- Knockout multiplier: x2 from R32 onward
    CASE
      WHEN m.stage IN ('r32', 'r16', 'qf', 'sf', 'third_place', 'final')
        THEN 2
      ELSE 1
    END AS multiplier,
    -- Track prediction type for tiebreakers
    CASE
      WHEN p.home_score = mr.home_score AND p.away_score = mr.away_score
        THEN 'exact'
      WHEN (
        (p.home_score > p.away_score AND mr.home_score > mr.away_score) OR
        (p.home_score < p.away_score AND mr.home_score < mr.away_score) OR
        (p.home_score = p.away_score AND mr.home_score = mr.away_score)
      )
        THEN 'result'
      ELSE 'wrong'
    END AS prediction_type
  FROM predictions p
  JOIN matches m ON m.id = p.match_id AND m.is_voided = FALSE
  JOIN match_results mr ON mr.match_id = p.match_id
)
SELECT
  mp.user_id,
  u.display_name,
  SUM(mp.base_points * mp.multiplier)::INT AS total_points,
  COUNT(*) FILTER (WHERE mp.prediction_type = 'exact')::INT AS exact_count,
  COUNT(*) FILTER (WHERE mp.prediction_type = 'result')::INT AS result_count,
  COUNT(*) FILTER (WHERE mp.prediction_type = 'wrong')::INT AS wrong_count,
  MIN(p_first.submitted_at) AS first_prediction_at
FROM match_points mp
JOIN users u ON u.id = mp.user_id
LEFT JOIN LATERAL (
  SELECT submitted_at FROM predictions WHERE user_id = mp.user_id ORDER BY submitted_at ASC LIMIT 1
) p_first ON TRUE
GROUP BY mp.user_id, u.display_name, p_first.submitted_at;

-- ============================================================
-- Auto-update updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER predictions_updated_at
  BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER bonus_predictions_updated_at
  BEFORE UPDATE ON bonus_predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
