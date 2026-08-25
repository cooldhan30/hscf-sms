-- =====================================================
-- 057: GAME ROOM -- student identity (replaces anonymous join)
--
-- Game Room originally let students join with just a nickname, no
-- account -- fine for a single live session, but a cross-game
-- leaderboard, per-student history, and solo practice all require
-- recognizing the SAME real student across many separate sessions,
-- which an anonymous nickname can't do. This adds student_id to
-- sms_game_players (mirrors sms_theni_enrollments.student_id) and a
-- solo-practice concept to sms_game_sessions, then replaces the
-- anonymous admin-client-only access with Theni's RLS pattern.
--
-- player_token is left in place on sms_game_players (harmless/unused
-- going forward) rather than dropped -- no functional gain from a
-- destructive column drop on a just-shipped feature.
-- =====================================================

ALTER TABLE sms_game_players ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES sms_students(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_sms_game_players_student ON sms_game_players(student_id);

-- A session is either teacher-hosted (existing behavior) or a student's
-- own solo practice -- host_teacher_id must become nullable to
-- represent the latter.
ALTER TABLE sms_game_sessions ALTER COLUMN host_teacher_id DROP NOT NULL;
ALTER TABLE sms_game_sessions ADD COLUMN IF NOT EXISTS is_solo_practice BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sms_game_sessions ADD COLUMN IF NOT EXISTS host_student_id UUID REFERENCES sms_students(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_sms_game_sessions_host_student ON sms_game_sessions(host_student_id);

-- sms_game_players: a student can read/insert/update only their own row
-- -- same EXISTS-through-sms_students shape as every Theni policy
-- (050_tamil_theni_core.sql). This is now the ONLY way a player row is
-- written for a teacher-hosted OR solo-practice session -- the
-- service-role admin client is no longer used for the student-facing
-- routes (see lib/require-student.ts).
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

CREATE POLICY "game_players: student manage own" ON sms_game_players
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_game_players.student_id AND s.profile_id = sms_current_user_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_game_players.student_id AND s.profile_id = sms_current_user_id())
  );

-- A student can't reassign their own row's identity columns after
-- joining, even under the otherwise-permissive UPDATE above -- same
-- column-level lock idiom as sms_theni_enrollments.
REVOKE UPDATE (student_id, session_id) ON sms_game_players FROM authenticated;

-- sms_game_answers previously had NO policies at all (admin-client-only
-- access). Mirrors sms_theni_word_progress's "no student_id of its own,
-- reached transitively through the parent row" pattern.
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

-- sms_game_sessions: a student can create/manage their own solo-practice
-- session. Teacher-hosted sessions are unaffected (the existing
-- "game_sessions: host manages own" policy from 055 stays -- Postgres
-- RLS policies are permissive/OR'd together, so this is purely additive).
CREATE POLICY "game_sessions: student manages own solo practice" ON sms_game_sessions
  FOR ALL USING (
    is_solo_practice = true AND
    host_student_id IN (SELECT id FROM sms_students WHERE profile_id = sms_current_user_id())
  )
  WITH CHECK (
    is_solo_practice = true AND
    host_student_id IN (SELECT id FROM sms_students WHERE profile_id = sms_current_user_id())
  );

-- A student's own RLS ("game_players: student manage own") only lets
-- them see their OWN row -- correct for privacy, but the live in-session
-- rank/leaderboard a student sees while playing needs to compare against
-- every OTHER player in that same session too. Rather than widen RLS
-- (which would let any student read every other student's row broadly),
-- this narrow SECURITY DEFINER RPC returns just id+score+nickname for
-- one specific session -- same "bypass RLS for one narrow, safe lookup"
-- idiom as sms_resolve_game_session_by_join_code.
CREATE OR REPLACE FUNCTION sms_game_session_leaderboard(p_session_id UUID)
RETURNS TABLE (id UUID, nickname TEXT, score INT, current_index INT, completed BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, nickname, score, current_index, completed
  FROM sms_game_players
  WHERE session_id = p_session_id
  ORDER BY score DESC;
$$;

-- The cross-game, all-students leaderboard (the "who's on top at year
-- end" view) needs to aggregate across EVERY student's rows, not just
-- the caller's own -- same bypass-RLS-for-one-narrow-safe-aggregate
-- idiom as above. Deliberately excludes is_solo_practice sessions (a
-- student practicing alone shouldn't be able to out-rank classmates who
-- only played real teacher-hosted games) and excludes anything not yet
-- completed (a mid-game score shouldn't count toward the standing
-- leaderboard). Exposes only points/games-played aggregates and the
-- student's display name -- never raw per-answer data.
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
