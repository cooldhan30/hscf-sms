-- =====================================================
-- 061: GAME ROOM -- fix RLS infinite recursion between sessions/players
--
-- Confirmed as a real bug: "infinite recursion detected in policy for
-- relation sms_game_players". sms_game_players' "host reads own
-- session's players" policy subqueries sms_game_sessions, and
-- sms_game_sessions' "player reads own session" policy (058) subqueries
-- sms_game_players right back -- evaluating either table's RLS re-
-- triggers the other's, looping forever.
--
-- Fix: move both cross-table checks into SECURITY DEFINER functions
-- (same idiom as the existing sms_teacher_owns_class helper) -- a
-- SECURITY DEFINER function's body runs with RLS bypassed for its own
-- queries, so it can safely check "is this session mine" without
-- re-triggering the calling table's policy evaluation.
-- =====================================================

CREATE OR REPLACE FUNCTION sms_is_game_session_host(p_session_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT sms_current_role() = 'admin' OR EXISTS (
    SELECT 1 FROM sms_game_sessions gs
    JOIN sms_teachers t ON t.id = gs.host_teacher_id
    WHERE gs.id = p_session_id AND t.profile_id = sms_current_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION sms_is_game_session_player(p_session_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_game_players p
    JOIN sms_students s ON s.id = p.student_id
    WHERE p.session_id = p_session_id AND s.profile_id = sms_current_user_id()
  );
$$;

DROP POLICY IF EXISTS "game_players: host reads own session's players" ON sms_game_players;
CREATE POLICY "game_players: host reads own session's players" ON sms_game_players
  FOR SELECT USING (sms_is_game_session_host(session_id));

DROP POLICY IF EXISTS "game_sessions: player reads own session" ON sms_game_sessions;
CREATE POLICY "game_sessions: player reads own session" ON sms_game_sessions
  FOR SELECT USING (sms_is_game_session_player(id));
