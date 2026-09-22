-- =====================================================
-- 077: GAMEROOM V2 PROGRESSION SYSTEM
--
-- The shared progression layer that belongs to GameRoom itself, not
-- any individual game engine: player level (derived from the existing
-- sms_gamev2_player_stats.total_xp -- no new column needed for it),
-- daily practice streaks, per-engine mastery, question-set completion
-- tracking, achievements/badges, and daily challenge progress.
--
-- ISOLATION: same guarantee every prior GameRoom V2 migration makes --
-- nothing here touches any legacy sms_game_* object. Every new table
-- only references sms_students/sms_gamev2_sessions/
-- sms_gamev2_question_sets by foreign key.
--
-- CENTRALIZATION: every table below is written to EXCLUSIVELY by
-- lib/gameRoomV2/rewards/rewardService.ts, called from
-- app/api/gameroom-v2/sessions/[id]/complete/route.ts -- the same
-- single finalization point that already (as of migration 076) is the
-- only place sms_gamev2_player_stats.total_xp/total_coins change. No
-- game engine, and no other route, ever writes to these tables
-- directly -- RLS below grants students SELECT only, matching
-- sms_gamev2_player_stats' existing "student read own, cannot write"
-- posture. This is the concrete mechanism behind "do not let
-- individual game clients arbitrarily award currency/achievements."
-- =====================================================

-- Extend the existing durable ledger with daily-PRACTICE-streak state
-- (distinct from sms_gamev2_sessions.current_streak/best_streak, which
-- is a per-session, in-session ANSWER streak that resets every game).
-- last_active_date is a plain DATE (server-computed, never client-
-- supplied) so "did the student play today" is a simple equality
-- check, not a timezone-sensitive timestamp comparison.
ALTER TABLE sms_gamev2_player_stats ADD COLUMN IF NOT EXISTS current_daily_streak INT NOT NULL DEFAULT 0;
ALTER TABLE sms_gamev2_player_stats ADD COLUMN IF NOT EXISTS best_daily_streak INT NOT NULL DEFAULT 0;
ALTER TABLE sms_gamev2_player_stats ADD COLUMN IF NOT EXISTS last_active_date DATE;
ALTER TABLE sms_gamev2_player_stats ADD COLUMN IF NOT EXISTS correct_answers_total INT NOT NULL DEFAULT 0;

-- =====================================================
-- ENGINE MASTERY -- one row per (student, engine)
--
-- "Game mastery" per the request: how much a student has engaged with
-- and succeeded at a SPECIFIC engine (Tower Defense, Racing, ...),
-- distinct from their overall account-wide level. engine_id is a plain
-- TEXT id into the code registry (lib/gameRoomV2/registry.ts), same
-- "no DB FK to a code registry" idiom sms_gamev2_sessions.engine_id
-- already uses.
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_gamev2_engine_mastery (
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  engine_id TEXT NOT NULL,
  sessions_completed INT NOT NULL DEFAULT 0,
  best_score INT NOT NULL DEFAULT 0,
  best_accuracy_pct NUMERIC(5, 1) NOT NULL DEFAULT 0,
  xp_from_engine INT NOT NULL DEFAULT 0,
  first_played_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_played_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, engine_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_gamev2_engine_mastery_student ON sms_gamev2_engine_mastery(student_id);

-- =====================================================
-- QUESTION SET COMPLETIONS -- one row per (student, question set)
--
-- Distinct from a single session: tracks how many times a student has
-- FULLY completed (and had rewards finalized for) the same Question
-- Set, powering "question-set completion" progress and the
-- Question Set Champion achievement (repeated review of the same
-- material, a real pedagogical signal a teacher cares about).
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_gamev2_question_set_completions (
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  question_set_id UUID NOT NULL REFERENCES sms_gamev2_question_sets(id) ON DELETE CASCADE,
  completion_count INT NOT NULL DEFAULT 0,
  best_accuracy_pct NUMERIC(5, 1) NOT NULL DEFAULT 0,
  first_completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, question_set_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_gamev2_qs_completions_student ON sms_gamev2_question_set_completions(student_id);

-- =====================================================
-- PLAYER ACHIEVEMENTS -- one row per (student, achievement) EARNED
--
-- The achievement CATALOG (name, description, icon) lives in code --
-- lib/gameRoomV2/progression/achievements.ts -- since these are
-- versioned-with-the-app definitions, not admin-editable content. This
-- table only records WHICH achievements a student has actually earned
-- and WHEN, plus a small context blob (e.g. which engine/session
-- triggered it) for a future teacher-facing detail view.
-- achievement_id is validated at the application layer against the
-- code catalog, not a DB CHECK, for the same "no migration needed to
-- add content" reasoning engine_id already follows.
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_gamev2_player_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  context JSONB,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_gamev2_player_achievements_student ON sms_gamev2_player_achievements(student_id);

-- =====================================================
-- DAILY CHALLENGE PROGRESS -- one row per (student, calendar day)
--
-- Which challenge is "today's" is a pure function of the date (see
-- lib/gameRoomV2/progression/dailyChallenge.ts's dailyChallengeForDate)
-- -- no challenge-definition table needed, only progress toward it.
-- challenge_id is stored so a completed day's record stays meaningful
-- even if the deterministic rotation is later edited in code.
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_gamev2_daily_challenge_progress (
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  challenge_date DATE NOT NULL,
  challenge_id TEXT NOT NULL,
  progress_count INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (student_id, challenge_date)
);

CREATE INDEX IF NOT EXISTS idx_sms_gamev2_daily_challenge_student ON sms_gamev2_daily_challenge_progress(student_id);

ALTER TABLE sms_gamev2_engine_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_gamev2_question_set_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_gamev2_player_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_gamev2_daily_challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gamev2_engine_mastery: admin all" ON sms_gamev2_engine_mastery
  FOR ALL USING (sms_current_role() = 'admin');

-- Student read-only, same posture as sms_gamev2_player_stats -- only
-- the SECURITY DEFINER RPC below (called exclusively from
-- rewardService.ts) can write here.
CREATE POLICY "gamev2_engine_mastery: student read own" ON sms_gamev2_engine_mastery
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_gamev2_engine_mastery.student_id AND s.profile_id = sms_current_user_id())
  );

CREATE POLICY "gamev2_engine_mastery: teacher read own set students" ON sms_gamev2_engine_mastery
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_gamev2_sessions sess
      JOIN sms_gamev2_question_sets qs ON qs.id = sess.question_set_id
      WHERE sess.student_id = sms_gamev2_engine_mastery.student_id AND qs.created_by = sms_current_user_id()
    )
  );

CREATE POLICY "gamev2_qs_completions: admin all" ON sms_gamev2_question_set_completions
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "gamev2_qs_completions: student read own" ON sms_gamev2_question_set_completions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_gamev2_question_set_completions.student_id AND s.profile_id = sms_current_user_id())
  );

CREATE POLICY "gamev2_qs_completions: teacher read own sets" ON sms_gamev2_question_set_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_gamev2_question_sets qs
      WHERE qs.id = sms_gamev2_question_set_completions.question_set_id AND qs.created_by = sms_current_user_id()
    )
  );

CREATE POLICY "gamev2_player_achievements: admin all" ON sms_gamev2_player_achievements
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "gamev2_player_achievements: student read own" ON sms_gamev2_player_achievements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_gamev2_player_achievements.student_id AND s.profile_id = sms_current_user_id())
  );

CREATE POLICY "gamev2_player_achievements: teacher read own set students" ON sms_gamev2_player_achievements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_gamev2_sessions sess
      JOIN sms_gamev2_question_sets qs ON qs.id = sess.question_set_id
      WHERE sess.student_id = sms_gamev2_player_achievements.student_id AND qs.created_by = sms_current_user_id()
    )
  );

CREATE POLICY "gamev2_daily_challenge: admin all" ON sms_gamev2_daily_challenge_progress
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "gamev2_daily_challenge: student read own" ON sms_gamev2_daily_challenge_progress
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_gamev2_daily_challenge_progress.student_id AND s.profile_id = sms_current_user_id())
  );

-- =====================================================
-- SECURITY DEFINER: the ONLY write path into the progression tables
-- above (engine mastery, question-set completions, achievements, daily
-- challenge progress) plus the streak/correct-answer-total columns on
-- sms_gamev2_player_stats -- mirroring sms_gamev2_apply_session_rewards'
-- existing posture exactly. Called exactly once per session, from
-- lib/gameRoomV2/rewards/rewardService.ts (itself called only from
-- sessions/[id]/complete/route.ts, guarded by rewards_finalized_at same
-- as today). Every argument here is a value the reward service computed
-- SERVER-SIDE from already-persisted session/answer rows -- nothing
-- here is a client-supplied number.
-- =====================================================
CREATE OR REPLACE FUNCTION sms_gamev2_apply_progression(
  p_student_id UUID,
  p_correct_answers_this_session INT,
  p_current_daily_streak INT,
  p_best_daily_streak INT,
  p_last_active_date DATE,
  p_engine_id TEXT,
  p_session_score INT,
  p_session_accuracy_pct NUMERIC,
  p_question_set_id UUID,
  p_achievement_ids TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sms_gamev2_player_stats
  SET
    correct_answers_total = correct_answers_total + GREATEST(p_correct_answers_this_session, 0),
    current_daily_streak = p_current_daily_streak,
    best_daily_streak = p_best_daily_streak,
    last_active_date = p_last_active_date,
    updated_at = NOW()
  WHERE student_id = p_student_id;

  INSERT INTO sms_gamev2_engine_mastery (student_id, engine_id, sessions_completed, best_score, best_accuracy_pct, xp_from_engine, first_played_at, last_played_at)
  VALUES (p_student_id, p_engine_id, 1, GREATEST(p_session_score, 0), GREATEST(p_session_accuracy_pct, 0), 0, NOW(), NOW())
  ON CONFLICT (student_id, engine_id) DO UPDATE SET
    sessions_completed = sms_gamev2_engine_mastery.sessions_completed + 1,
    best_score = GREATEST(sms_gamev2_engine_mastery.best_score, GREATEST(p_session_score, 0)),
    best_accuracy_pct = GREATEST(sms_gamev2_engine_mastery.best_accuracy_pct, GREATEST(p_session_accuracy_pct, 0)),
    last_played_at = NOW();

  INSERT INTO sms_gamev2_question_set_completions (student_id, question_set_id, completion_count, best_accuracy_pct, first_completed_at, last_completed_at)
  VALUES (p_student_id, p_question_set_id, 1, GREATEST(p_session_accuracy_pct, 0), NOW(), NOW())
  ON CONFLICT (student_id, question_set_id) DO UPDATE SET
    completion_count = sms_gamev2_question_set_completions.completion_count + 1,
    best_accuracy_pct = GREATEST(sms_gamev2_question_set_completions.best_accuracy_pct, GREATEST(p_session_accuracy_pct, 0)),
    last_completed_at = NOW();

  IF p_achievement_ids IS NOT NULL AND array_length(p_achievement_ids, 1) > 0 THEN
    INSERT INTO sms_gamev2_player_achievements (student_id, achievement_id)
    SELECT p_student_id, unnest(p_achievement_ids)
    ON CONFLICT (student_id, achievement_id) DO NOTHING;
  END IF;
END;
$$;

-- =====================================================
-- SECURITY DEFINER: applies today's daily-challenge progress and, if
-- the challenge is completed by this update, grants its XP/coins via
-- the SAME durable-ledger increment sms_gamev2_apply_session_rewards
-- uses -- called at most once per session from rewardService.ts, and
-- internally idempotent: completing an already-completed day's
-- challenge again does nothing further (completed_at, once set, is
-- never overwritten, and the reward is granted only on the INSERT/
-- UPDATE that first reaches the goal).
-- =====================================================
CREATE OR REPLACE FUNCTION sms_gamev2_apply_daily_challenge_progress(
  p_student_id UUID,
  p_challenge_date DATE,
  p_challenge_id TEXT,
  p_new_progress_count INT,
  p_goal_count INT,
  p_xp_reward INT,
  p_coins_reward INT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_already_completed BOOLEAN;
  v_now_completed BOOLEAN;
BEGIN
  SELECT (completed_at IS NOT NULL) INTO v_was_already_completed
  FROM sms_gamev2_daily_challenge_progress
  WHERE student_id = p_student_id AND challenge_date = p_challenge_date;

  v_now_completed := p_new_progress_count >= p_goal_count;

  INSERT INTO sms_gamev2_daily_challenge_progress (student_id, challenge_date, challenge_id, progress_count, completed_at)
  VALUES (p_student_id, p_challenge_date, p_challenge_id, p_new_progress_count, CASE WHEN v_now_completed THEN NOW() ELSE NULL END)
  ON CONFLICT (student_id, challenge_date) DO UPDATE SET
    progress_count = GREATEST(sms_gamev2_daily_challenge_progress.progress_count, p_new_progress_count),
    completed_at = COALESCE(sms_gamev2_daily_challenge_progress.completed_at, CASE WHEN v_now_completed THEN NOW() ELSE NULL END);

  IF v_now_completed AND NOT COALESCE(v_was_already_completed, FALSE) THEN
    UPDATE sms_gamev2_player_stats
    SET total_xp = total_xp + GREATEST(p_xp_reward, 0),
        total_coins = total_coins + GREATEST(p_coins_reward, 0),
        updated_at = NOW()
    WHERE student_id = p_student_id;
  END IF;
END;
$$;
