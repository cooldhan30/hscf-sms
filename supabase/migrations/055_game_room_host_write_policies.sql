-- =====================================================
-- 055: GAME ROOM -- host write policies
--
-- 054_game_room.sql only granted SELECT on sms_game_sessions/
-- sms_game_players for the host's own RLS-scoped Clerk client -- every
-- session-lifecycle route (create/start/pause/resume/end) uses that
-- same client (requireTeacher(), matching every other teacher route in
-- this app), so creating a session failed with "new row violates
-- row-level security policy for table sms_game_sessions": there was no
-- INSERT/UPDATE policy at all, just SELECT.
--
-- Replaces each SELECT-only policy with a FOR ALL policy scoped to the
-- teacher's own sessions -- covers INSERT (session creation),
-- UPDATE (start/pause/resume/end), and the existing SELECT (dashboard
-- reads + Realtime) in one policy, same shape as every other
-- "teacher manage own X" policy in this schema (e.g. sms_teacher_stories,
-- sms_assignments).
-- =====================================================

DROP POLICY IF EXISTS "game_sessions: host reads own" ON sms_game_sessions;
CREATE POLICY "game_sessions: host manages own" ON sms_game_sessions
  FOR ALL USING (
    sms_current_role() = 'admin' OR
    host_teacher_id IN (SELECT id FROM sms_teachers WHERE profile_id = sms_current_user_id())
  )
  WITH CHECK (
    sms_current_role() = 'admin' OR
    host_teacher_id IN (SELECT id FROM sms_teachers WHERE profile_id = sms_current_user_id())
  );

-- sms_game_players itself is never written by the teacher's client
-- (players are inserted by the anonymous /join route via the
-- service-role admin client) -- SELECT-only remains correct there, no
-- change needed.
