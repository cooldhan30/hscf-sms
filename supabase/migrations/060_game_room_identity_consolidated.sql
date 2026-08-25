-- =====================================================
-- 060: GAME ROOM -- consolidated re-apply of 057 + 058 + 059
--
-- The PostgREST "Could not find the 'student_id' column ... in the
-- schema cache" error confirms 057 was never actually applied to this
-- database, despite 058/059 apparently being attempted -- this single
-- script folds all three together so there's no more ambiguity about
-- what state the database is in. Every statement is idempotent (guards
-- against already existing / uses DROP ... IF EXISTS first), so running
-- this on a database that's already fully up to date is a safe no-op.
-- =====================================================

-- ---- from 057 ----

ALTER TABLE sms_game_players ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES sms_students(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_sms_game_players_student ON sms_game_players(student_id);

ALTER TABLE sms_game_sessions ALTER COLUMN host_teacher_id DROP NOT NULL;
ALTER TABLE sms_game_sessions ADD COLUMN IF NOT EXISTS is_solo_practice BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sms_game_sessions ADD COLUMN IF NOT EXISTS host_student_id UUID REFERENCES sms_students(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_sms_game_sessions_host_student ON sms_game_sessions(host_student_id);

DROP POLICY IF EXISTS "game_players: host reads own session's players" ON sms_game_players;
CREATE POLICY "game_players: host reads own session's players" ON sms_game_players
  FOR SELECT USING (
    sms_current_role() = 'admin' OR
    session_id IN (
      SELECT id FROM sms_game_sessions WHERE host_teacher_id IN (
        SELECT id FROM sms_teachers WHERE profile_id = sms_current_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "game_players: student manage own" ON sms_game_players;
CREATE POLICY "game_players: student manage own" ON sms_game_players
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_game_players.student_id AND s.profile_id = sms_current_user_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_game_players.student_id AND s.profile_id = sms_current_user_id())
  );

-- REVOKE is always safe to re-run even if never granted.
REVOKE UPDATE (student_id, session_id) ON sms_game_players FROM authenticated;

DROP POLICY IF EXISTS "game_answers: student manage own" ON sms_game_answers;
CREATE POLICY "game_answers: student manage own" ON sms_game_answers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sms_game_players p JOIN sms_students s ON s.id = p.student_id
      WHERE p.id = sms_game_answers.player_id AND s.profile_id = sms_current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sms_game_players p JOIN sms_students s ON s.id = p.student_id
      WHERE p.id = sms_game_answers.player_id AND s.profile_id = sms_current_user_id()
    )
  );

DROP POLICY IF EXISTS "game_sessions: student manages own solo practice" ON sms_game_sessions;
CREATE POLICY "game_sessions: student manages own solo practice" ON sms_game_sessions
  FOR ALL USING (
    is_solo_practice = true AND
    host_student_id IN (SELECT id FROM sms_students WHERE profile_id = sms_current_user_id())
  )
  WITH CHECK (
    is_solo_practice = true AND
    host_student_id IN (SELECT id FROM sms_students WHERE profile_id = sms_current_user_id())
  );

CREATE OR REPLACE FUNCTION sms_game_session_leaderboard(p_session_id UUID)
RETURNS TABLE (id UUID, nickname TEXT, score INT, current_index INT, completed BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, nickname, score, current_index, completed
  FROM sms_game_players
  WHERE session_id = p_session_id
  ORDER BY score DESC;
$$;

CREATE OR REPLACE FUNCTION sms_game_room_alltime_leaderboard()
RETURNS TABLE (student_id UUID, student_name TEXT, total_points BIGINT, games_played BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    s.id AS student_id,
    (s.first_name || ' ' || s.last_name) AS student_name,
    SUM(p.score)::BIGINT AS total_points,
    COUNT(*)::BIGINT AS games_played
  FROM sms_game_players p
  JOIN sms_game_sessions g ON g.id = p.session_id
  JOIN sms_students s ON s.id = p.student_id
  WHERE p.completed = true AND g.is_solo_practice = false AND p.student_id IS NOT NULL
  GROUP BY s.id, s.first_name, s.last_name
  ORDER BY total_points DESC;
$$;

-- ---- from 058 ----

DROP POLICY IF EXISTS "game_sessions: player reads own session" ON sms_game_sessions;
CREATE POLICY "game_sessions: player reads own session" ON sms_game_sessions
  FOR SELECT USING (
    id IN (
      SELECT session_id FROM sms_game_players p
      JOIN sms_students s ON s.id = p.student_id
      WHERE s.profile_id = sms_current_user_id()
    )
  );

-- ---- from 059 ----

DROP FUNCTION IF EXISTS sms_resolve_game_session_by_join_code(text);
CREATE OR REPLACE FUNCTION sms_resolve_game_session_by_join_code(p_code TEXT)
RETURNS TABLE (session_id UUID, status TEXT, game_type TEXT, question_ids TEXT[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, status, game_type, question_ids FROM sms_game_sessions WHERE join_code = p_code;
$$;

-- ---- diagnostic: confirm the schema actually landed ----
-- Should return exactly 4 columns for sms_game_players (id, ..., student_id, ...)
-- and 4 columns of sms_resolve_game_session_by_join_code's return type.
SELECT column_name FROM information_schema.columns
WHERE table_name = 'sms_game_players' AND column_name IN ('student_id', 'nickname', 'session_id');
