-- =====================================================
-- 058: GAME ROOM -- let a joined student read their own session row
--
-- Confirmed as a real bug: 057 added RLS letting a student manage their
-- OWN sms_game_players row, but never granted them SELECT on the
-- sms_game_sessions row that player row belongs to -- only the hosting
-- teacher ("game_sessions: host manages own") or a solo-practice student
-- ("game_sessions: student manages own solo practice") could read a
-- session. A student joining a TEACHER-HOSTED session had no read path
-- to that session at all, so requirePlayer.ts's session lookup silently
-- returned nothing and every subsequent call (join/state/answer) failed
-- with "Game session not found," even though the join code itself
-- resolved fine via the SECURITY DEFINER RPC.
--
-- Fix: a student who is (or is about to become, via the join RPC) a
-- player in a session can read that session's row. This is exactly the
-- access they already have transitively (the join RPC bypasses RLS to
-- resolve the code, and once joined their player row proves membership),
-- so this isn't a broader exposure -- just making the direct SELECT work.
-- =====================================================

CREATE POLICY "game_sessions: player reads own session" ON sms_game_sessions
  FOR SELECT USING (
    id IN (
      SELECT session_id FROM sms_game_players p
      JOIN sms_students s ON s.id = p.student_id
      WHERE s.profile_id = sms_current_user_id()
    )
  );
