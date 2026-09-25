-- =====================================================
-- 086: GAMEROOM V2 LIVE CLASSROOM -- FIX RLS INFINITE RECURSION
--
-- Found in production 2026-09-24: any query on sms_gamev2_live_sessions
-- or sms_gamev2_live_participants failed with 42P17 "infinite recursion
-- detected in policy". Migration 079's policies reference each other
-- (live_sessions "participant read own" subqueries participants;
-- participants "host teacher read own session" subqueries live_sessions)
-- and one participants policy subqueries participants itself -- so
-- Postgres re-applies RLS inside RLS forever. Live Classroom could not
-- work at all for students or teachers.
--
-- Fix (same pattern as 061_game_room_fix_rls_recursion.sql /
-- 067_mayangoli_fix_rls_recursion.sql): move each cross-table check into
-- a SECURITY DEFINER helper that reads the other table WITHOUT RLS and
-- only ever answers a yes/no question about the CALLER. The access each
-- policy grants is identical to before -- only how it's evaluated
-- changes. No data is touched.
-- =====================================================

-- Is the calling user a participant of this live session?
CREATE OR REPLACE FUNCTION sms_gamev2_is_live_participant(p_live_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_gamev2_live_participants p
    JOIN sms_students s ON s.id = p.student_id
    WHERE p.live_session_id = p_live_session_id AND s.profile_id = sms_current_user_id()
  );
$$;

-- Is the calling user the host teacher of this live session?
CREATE OR REPLACE FUNCTION sms_gamev2_is_live_host(p_live_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_gamev2_live_sessions ls
    JOIN sms_teachers t ON t.id = ls.host_teacher_id
    WHERE ls.id = p_live_session_id AND t.profile_id = sms_current_user_id()
  );
$$;

REVOKE ALL ON FUNCTION sms_gamev2_is_live_participant(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION sms_gamev2_is_live_host(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sms_gamev2_is_live_participant(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sms_gamev2_is_live_host(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "gamev2_live_sessions: participant read own" ON sms_gamev2_live_sessions;
CREATE POLICY "gamev2_live_sessions: participant read own" ON sms_gamev2_live_sessions
  FOR SELECT USING (sms_gamev2_is_live_participant(id));

DROP POLICY IF EXISTS "gamev2_live_participants: host teacher read own session" ON sms_gamev2_live_participants;
CREATE POLICY "gamev2_live_participants: host teacher read own session" ON sms_gamev2_live_participants
  FOR SELECT USING (sms_gamev2_is_live_host(live_session_id));

DROP POLICY IF EXISTS "gamev2_live_participants: student read own session roster" ON sms_gamev2_live_participants;
CREATE POLICY "gamev2_live_participants: student read own session roster" ON sms_gamev2_live_participants
  FOR SELECT USING (sms_gamev2_is_live_participant(live_session_id));
