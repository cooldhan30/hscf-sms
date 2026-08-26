-- =====================================================
-- 063: GAME ROOM -- fix student session INSERT for
-- leaderboard-counted interactive games
--
-- 060's "game_sessions: student manages own solo practice" policy
-- required is_solo_practice = true. That was correct while every
-- student-created session was ordinary solo quiz practice (which is
-- deliberately excluded from the all-time leaderboard). But the two
-- Uyir Ezhuthukkal interactive games (drag-order, memory-match) were
-- later changed to insert with is_solo_practice = false on purpose, so
-- sms_game_room_alltime_leaderboard()'s "is_solo_practice = false"
-- filter would include them -- that insert now fails RLS with "new row
-- violates row-level security policy for table sms_game_sessions",
-- since no existing policy covers a student-hosted row with
-- is_solo_practice = false.
--
-- Fix: drop the is_solo_practice condition entirely from this policy.
-- A student may only ever manage sessions where they are the host
-- (host_student_id resolves to their own profile) regardless of the
-- is_solo_practice flag -- that ownership check is what actually
-- matters for security; is_solo_practice is a leaderboard-inclusion
-- flag, not an authorization boundary.
-- =====================================================

DROP POLICY IF EXISTS "game_sessions: student manages own solo practice" ON sms_game_sessions;
CREATE POLICY "game_sessions: student manages own sessions" ON sms_game_sessions
  FOR ALL USING (
    host_student_id IN (SELECT id FROM sms_students WHERE profile_id = sms_current_user_id())
  )
  WITH CHECK (
    host_student_id IN (SELECT id FROM sms_students WHERE profile_id = sms_current_user_id())
  );
