-- =====================================================
-- 080: GAMEROOM V2 LIVE CLASSROOM HARDENING
--
-- Fixes the P0 privilege-escalation gap identified in
-- docs/gameroom-v2-completion-plan.md's Phase 0: migration 079's four
-- host-lifecycle SECURITY DEFINER functions
-- (sms_gamev2_{start,pause,resume,end}_live_session) had no REVOKE
-- statement and no internal caller-authorization check, so any
-- authenticated Supabase client (a student, or a teacher who is not
-- the session's host) could call them directly via
-- supabase.rpc(...), bypassing the API route's requireLiveSessionHost
-- guard entirely, and hijack/start/pause/resume/end another
-- teacher's live session or fabricate participant session rows.
-- Unlike migration 079's own sms_gamev2_resolve_live_session_by_join_code
-- (which already re-checks class enrollment internally, defense-in-
-- depth against exactly this class of bypass), the four lifecycle
-- functions trusted the caller unconditionally.
--
-- Fix: add an internal ownership check inside each function body,
-- verifying the CALLING user is actually
-- sms_gamev2_live_sessions.host_teacher_id for the given
-- p_live_session_id, using the exact same
-- "t.profile_id = sms_current_user_id()" pattern the RLS policies in
-- migration 079 already establish.
--
-- IMPORTANT, and the reason this migration does NOT also add a blanket
-- "REVOKE ALL ... FROM anon, authenticated" the way
-- 030_class_promotion.sql/031_multi_role.sql/033_student_payments.sql
-- do for THEIR SECURITY DEFINER functions: those are called via
-- createAdminClient() (a genuinely privileged service-role connection
-- -- see app/api/admin/promotions/route.ts), so revoking `authenticated`
-- costs that caller nothing. Live Classroom's own API routes
-- (start/pause/resume/end) call supabase.rpc(...) through
-- lib/supabase/server.ts's createClient(), which authenticates as the
-- CALLING USER via their Clerk JWT -- Postgres sees this connection AS
-- `authenticated`, not as a service role. A REVOKE ALL ... FROM
-- authenticated here would break the legitimate host-only API route
-- itself, not just a would-be attacker calling the RPC directly. The
-- ownership check below is therefore the WHOLE fix, not a defense-in-
-- depth supplement to a REVOKE: it's what makes "start MY session"
-- different from "start ANY session" for every caller, including the
-- legitimate route's own connection.
-- =====================================================

CREATE OR REPLACE FUNCTION sms_gamev2_start_live_session(p_live_session_id UUID, p_question_order UUID[], p_participant_ids UUID[])
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_live sms_gamev2_live_sessions%ROWTYPE;
  v_participant RECORD;
  v_new_session_id UUID;
  v_started_count INT := 0;
BEGIN
  SELECT * INTO v_live FROM sms_gamev2_live_sessions WHERE id = p_live_session_id;
  IF NOT FOUND OR v_live.status != 'LOBBY' THEN
    RAISE EXCEPTION 'Live session is not in LOBBY status';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM sms_teachers t WHERE t.id = v_live.host_teacher_id AND t.profile_id = sms_current_user_id()
  ) THEN
    RAISE EXCEPTION 'Only the host teacher can start this live session';
  END IF;

  FOR v_participant IN
    SELECT * FROM sms_gamev2_live_participants WHERE live_session_id = p_live_session_id AND id = ANY(p_participant_ids)
  LOOP
    INSERT INTO sms_gamev2_sessions (question_set_id, engine_id, student_id, status, question_order, current_index)
    VALUES (v_live.question_set_id, v_live.engine_id, v_participant.student_id, 'READY', p_question_order, 0)
    RETURNING id INTO v_new_session_id;

    UPDATE sms_gamev2_live_participants SET session_id = v_new_session_id WHERE id = v_participant.id;
    v_started_count := v_started_count + 1;
  END LOOP;

  UPDATE sms_gamev2_live_sessions
  SET status = 'ACTIVE', question_order = p_question_order, started_at = NOW()
  WHERE id = p_live_session_id;

  RETURN v_started_count;
END;
$$;

CREATE OR REPLACE FUNCTION sms_gamev2_pause_live_session(p_live_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_teacher_id UUID;
BEGIN
  SELECT host_teacher_id INTO v_host_teacher_id FROM sms_gamev2_live_sessions WHERE id = p_live_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Live session not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM sms_teachers t WHERE t.id = v_host_teacher_id AND t.profile_id = sms_current_user_id()
  ) THEN
    RAISE EXCEPTION 'Only the host teacher can pause this live session';
  END IF;

  UPDATE sms_gamev2_sessions
  SET status = 'PAUSED', paused_at = NOW()
  WHERE status = 'ACTIVE'
    AND id IN (SELECT session_id FROM sms_gamev2_live_participants WHERE live_session_id = p_live_session_id AND session_id IS NOT NULL);

  UPDATE sms_gamev2_live_sessions SET status = 'PAUSED', paused_at = NOW() WHERE id = p_live_session_id AND status = 'ACTIVE';
END;
$$;

CREATE OR REPLACE FUNCTION sms_gamev2_resume_live_session(p_live_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_live sms_gamev2_live_sessions%ROWTYPE;
  v_paused_for_seconds INT;
BEGIN
  SELECT * INTO v_live FROM sms_gamev2_live_sessions WHERE id = p_live_session_id;
  IF NOT FOUND OR v_live.status != 'PAUSED' THEN
    RAISE EXCEPTION 'Live session is not PAUSED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM sms_teachers t WHERE t.id = v_live.host_teacher_id AND t.profile_id = sms_current_user_id()
  ) THEN
    RAISE EXCEPTION 'Only the host teacher can resume this live session';
  END IF;

  v_paused_for_seconds := COALESCE(ROUND(EXTRACT(EPOCH FROM (NOW() - v_live.paused_at))), 0);

  UPDATE sms_gamev2_sessions s
  SET status = 'ACTIVE',
      paused_at = NULL,
      current_question_started_at = COALESCE(s.current_question_started_at, NOW()) + (v_paused_for_seconds || ' seconds')::INTERVAL,
      pause_duration_seconds = s.pause_duration_seconds + v_paused_for_seconds
  FROM sms_gamev2_live_participants p
  WHERE p.session_id = s.id AND p.live_session_id = p_live_session_id AND s.status = 'PAUSED';

  UPDATE sms_gamev2_live_sessions
  SET status = 'ACTIVE', paused_at = NULL, pause_duration_seconds = pause_duration_seconds + v_paused_for_seconds
  WHERE id = p_live_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION sms_gamev2_end_live_session(p_live_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_teacher_id UUID;
BEGIN
  SELECT host_teacher_id INTO v_host_teacher_id FROM sms_gamev2_live_sessions WHERE id = p_live_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Live session not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM sms_teachers t WHERE t.id = v_host_teacher_id AND t.profile_id = sms_current_user_id()
  ) THEN
    RAISE EXCEPTION 'Only the host teacher can end this live session';
  END IF;

  UPDATE sms_gamev2_sessions
  SET status = 'ABANDONED', abandoned_at = NOW()
  WHERE status IN ('CREATED', 'READY', 'ACTIVE', 'PAUSED')
    AND id IN (SELECT session_id FROM sms_gamev2_live_participants WHERE live_session_id = p_live_session_id AND session_id IS NOT NULL);

  UPDATE sms_gamev2_live_sessions SET status = 'ENDED', ended_at = NOW() WHERE id = p_live_session_id AND status != 'ENDED';
END;
$$;

-- Revoked from `anon` only (an unauthenticated caller has no
-- sms_current_user_id() at all, so the ownership check above would
-- reject them anyway -- this is belt-and-suspenders, matching
-- 031_multi_role.sql's sms_switch_active_role precedent exactly, which
-- revokes only from anon for the identical reason: its caller is also
-- the ordinary per-user authenticated client, not an admin client).
-- `authenticated` deliberately keeps EXECUTE -- see the header comment.
REVOKE ALL ON FUNCTION sms_gamev2_start_live_session(UUID, UUID[], UUID[]) FROM anon;
REVOKE ALL ON FUNCTION sms_gamev2_pause_live_session(UUID) FROM anon;
REVOKE ALL ON FUNCTION sms_gamev2_resume_live_session(UUID) FROM anon;
REVOKE ALL ON FUNCTION sms_gamev2_end_live_session(UUID) FROM anon;

-- =====================================================
-- LATE JOIN: bridges a single participant into an already-ACTIVE live
-- session's shared question_order -- the missing half of the
-- lifecycle sms_gamev2_start_live_session only ever runs once, for
-- whoever was connected at the moment the host clicked Start. A
-- student who joins the lobby after that (a late arrival, or a
-- reconnect after their FIRST join attempt raced the start) needs
-- their own sms_gamev2_sessions row created on demand, using the
-- live session's ALREADY-FIXED question_order (never a fresh shuffle
-- -- a late joiner still answers the same questions in the same
-- order as everyone else, just starting from question 0 like any
-- fresh session). A student inserting their OWN sms_gamev2_sessions
-- row is already RLS-permitted ("gamev2_sessions: student manage
-- own" is FOR ALL), but there is no ordinary policy letting a student
-- also write sms_gamev2_live_participants.session_id (only the host
-- can write that table's rows per "gamev2_live_participants: student
-- manage own" being scoped to the student's OWN participant row's
-- other fields, not session_id specifically being safe to leave
-- student-writable without coupling it to a real session actually
-- existing) -- SECURITY DEFINER here makes the insert-then-link an
-- atomic, single-statement-boundary operation instead of two
-- separately-authorized writes a client could otherwise race or
-- desync. Ownership here is "the calling student owns the
-- participant row", not "is the host" -- the mirror image of the four
-- functions above.
-- =====================================================
CREATE OR REPLACE FUNCTION sms_gamev2_join_active_live_session(p_live_session_id UUID, p_student_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_live sms_gamev2_live_sessions%ROWTYPE;
  v_participant sms_gamev2_live_participants%ROWTYPE;
  v_new_session_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sms_students s WHERE s.id = p_student_id AND s.profile_id = sms_current_user_id()
  ) THEN
    RAISE EXCEPTION 'You can only join a live session as yourself';
  END IF;

  SELECT * INTO v_live FROM sms_gamev2_live_sessions WHERE id = p_live_session_id;
  IF NOT FOUND OR v_live.status NOT IN ('ACTIVE', 'PAUSED') THEN
    RAISE EXCEPTION 'Live session is not currently active';
  END IF;

  SELECT * INTO v_participant FROM sms_gamev2_live_participants WHERE live_session_id = p_live_session_id AND student_id = p_student_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You have not joined this live session';
  END IF;

  -- Already bridged (a reconnect, or a duplicate call) -- return the
  -- existing session id rather than creating a second one; the UNIQUE
  -- (live_session_id, student_id) constraint on the participants table
  -- already guarantees at most one participant row per student, and
  -- this makes the bridge itself idempotent too.
  IF v_participant.session_id IS NOT NULL THEN
    RETURN v_participant.session_id;
  END IF;

  INSERT INTO sms_gamev2_sessions (question_set_id, engine_id, student_id, status, question_order, current_index)
  VALUES (v_live.question_set_id, v_live.engine_id, p_student_id, 'READY', v_live.question_order, 0)
  RETURNING id INTO v_new_session_id;

  UPDATE sms_gamev2_live_participants SET session_id = v_new_session_id WHERE id = v_participant.id;

  RETURN v_new_session_id;
END;
$$;

REVOKE ALL ON FUNCTION sms_gamev2_join_active_live_session(UUID, UUID) FROM anon;

-- =====================================================
-- STALE ROOMS: sms_gamev2_resolve_live_session_by_join_code needs to
-- additionally return created_at so the calling API route
-- (app/api/gameroom-v2/live/join/route.ts) can apply
-- lib/gameRoomV2/liveClassroom/lifecycle.ts's isLiveSessionStale()
-- check and refuse to bridge a student into a room the host
-- abandoned hours ago, rather than silently seating them in a dead
-- lobby/game that will never progress. Postgres requires DROP +
-- CREATE (not a plain CREATE OR REPLACE) to change a RETURNS TABLE
-- function's column list.
-- =====================================================
DROP FUNCTION IF EXISTS sms_gamev2_resolve_live_session_by_join_code(TEXT, UUID);

CREATE FUNCTION sms_gamev2_resolve_live_session_by_join_code(p_join_code TEXT, p_student_id UUID)
RETURNS TABLE (
  live_session_id UUID,
  status TEXT,
  class_id UUID,
  engine_id TEXT,
  question_set_id UUID,
  is_enrolled BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session sms_gamev2_live_sessions%ROWTYPE;
  v_enrolled BOOLEAN;
BEGIN
  SELECT * INTO v_session FROM sms_gamev2_live_sessions WHERE join_code = UPPER(p_join_code);

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM sms_class_enrollments ce
    WHERE ce.class_id = v_session.class_id AND ce.student_id = p_student_id AND ce.status = 'active'
  ) INTO v_enrolled;

  RETURN QUERY SELECT v_session.id, v_session.status, v_session.class_id, v_session.engine_id, v_session.question_set_id, v_enrolled, v_session.created_at;
END;
$$;

REVOKE ALL ON FUNCTION sms_gamev2_resolve_live_session_by_join_code(TEXT, UUID) FROM anon;
