-- =====================================================
-- 067: MAYANGOLI -- fix RLS infinite recursion between sessions/players
--
-- Same bug as 061_game_room_fix_rls_recursion.sql, reintroduced here
-- because 065 copied the original (pre-061) cross-table policy shape:
-- sms_mayangoli_players' "host reads own session's players" policy
-- subqueries sms_mayangoli_sessions, and sms_mayangoli_sessions'
-- "player reads own session" policy subqueries sms_mayangoli_players
-- right back -- evaluating either table's RLS re-triggers the other's,
-- looping forever ("infinite recursion detected in policy for relation
-- sms_mayangoli_sessions").
--
-- Fix: identical idiom -- move both cross-table checks into SECURITY
-- DEFINER functions, whose own internal queries run with RLS bypassed,
-- so they can check "is this session mine" without re-triggering the
-- calling table's policy evaluation.
-- =====================================================

CREATE OR REPLACE FUNCTION sms_is_mayangoli_session_host(p_session_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT sms_current_role() = 'admin' OR EXISTS (
    SELECT 1 FROM sms_mayangoli_sessions ms
    JOIN sms_teachers t ON t.id = ms.host_teacher_id
    WHERE ms.id = p_session_id AND t.profile_id = sms_current_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION sms_is_mayangoli_session_player(p_session_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_mayangoli_players p
    JOIN sms_students s ON s.id = p.student_id
    WHERE p.session_id = p_session_id AND s.profile_id = sms_current_user_id()
  );
$$;

DROP POLICY IF EXISTS "mayangoli_players: host reads own session's players" ON sms_mayangoli_players;
CREATE POLICY "mayangoli_players: host reads own session's players" ON sms_mayangoli_players
  FOR SELECT USING (sms_is_mayangoli_session_host(session_id));

DROP POLICY IF EXISTS "mayangoli_sessions: player reads own session" ON sms_mayangoli_sessions;
CREATE POLICY "mayangoli_sessions: player reads own session" ON sms_mayangoli_sessions
  FOR SELECT USING (sms_is_mayangoli_session_player(id));
