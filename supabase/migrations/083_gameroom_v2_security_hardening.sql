-- =====================================================
-- 083: GAMEROOM V2 SECURITY / DATA-INTEGRITY HARDENING
--
-- Closes the gaps found by the 2026-09-24 security audit (see
-- docs/gameroom-v2-completion-plan.md, Phase 14). The threat model is
-- a student who opens devtools: the browser already holds a Clerk JWT
-- that Supabase accepts (lib/supabase/client.ts, used for Realtime)
-- plus the public anon key, so ANY table/RPC the `authenticated` role
-- can reach is reachable by hand-crafted PostgREST calls, completely
-- bypassing app/api/gameroom-v2/**. RLS and RPC bodies are therefore
-- the real boundary -- not the API routes.
--
-- What was wrong, and what this migration does about it:
--
-- 1. REWARD RPCs HAD NO CALLER CHECK AND WERE EXECUTABLE BY EVERYONE.
--    sms_gamev2_apply_session_rewards / _apply_progression /
--    _apply_daily_challenge_progress (076/077) are SECURITY DEFINER,
--    take the student id and every amount as parameters, and had
--    Postgres' default EXECUTE-to-PUBLIC grant (which includes `anon`).
--    Anyone could mint unlimited XP/coins/achievements for any
--    student. Fix: EXECUTE revoked from PUBLIC/anon/authenticated and
--    granted only to service_role; rewardService.ts now calls them
--    through the server-only admin client, after the route has
--    authenticated the student and atomically claimed the session.
--
-- 2. STUDENTS COULD WRITE THEIR OWN SCORE ROWS DIRECTLY.
--    "student manage own" was FOR ALL on sms_gamev2_sessions,
--    sms_gamev2_answers, sms_gamev2_learning_events,
--    sms_gamev2_skill_practice and sms_gamev2_live_participants. A
--    student could set score/correct_count/xp_earned/status on their
--    session (inflating /complete rewards, the live leaderboard and
--    co-op boss HP), insert is_correct=true answers (spoofing live race
--    position, which is replayed from answers), poison teacher
--    analytics, and insert themselves into ANY live session --
--    bypassing both the join code and the class-enrollment check --
--    or rename themselves on the class roster. Fix: every one of those
--    policies becomes SELECT-only. All writes now happen in the API
--    routes through the server-only admin client, always scoped by the
--    authenticated student's own id.
--
-- 3. STUDENTS COULD READ THE ANSWER KEY.
--    "gamev2_questions: tester read published set" let any allowlisted
--    tester (students included) SELECT sms_gamev2_questions.payload --
--    correctAnswer / acceptedAnswers / pairs / answerKey -- straight
--    from PostgREST, defeating state/route.ts's stripAnswerKey(). Fix:
--    policy dropped. Students never read questions directly; the
--    gameplay routes read them server-side after authorizing the
--    session, and only ever send the stripped payload. Teachers keep
--    their own "manage own set" / "read shared set" policies. The
--    set-level (metadata-only) tester policy is narrowed to STUDENT
--    testers, so a teacher tester no longer sees another teacher's
--    PRIVATE set just because it was published.
--
-- 4. THE JOIN-CODE RESOLVER LEAKED ACROSS STUDENTS.
--    sms_gamev2_resolve_live_session_by_join_code trusted an arbitrary
--    p_student_id (probe any student's enrollment) and returned the
--    live_session_id even when is_enrolled was false (which, combined
--    with #2, was enough to join another class's session). Fix: the
--    caller must BE p_student_id, and a non-enrolled caller gets no row.
--
-- 5. "REVOKE ... FROM anon" IN 080-082 WAS A NO-OP.
--    Functions are EXECUTE-to-PUBLIC by default and anon is a member of
--    PUBLIC, so revoking from anon alone changes nothing. Those RPCs
--    are still safe (each checks sms_current_user_id() internally, NULL
--    for anon), but the intent is now actually applied: revoked from
--    PUBLIC + anon, granted explicitly to authenticated + service_role.
--
-- 6. HOST TEACHERS COULD REWRITE A LIVE SESSION ROW DIRECTLY.
--    "host teacher manage own" was FOR ALL, so a host could flip
--    status to ACTIVE without creating participant sessions, splice
--    arbitrary question ids into question_order, or move class_id to a
--    class they don't teach (opening the join code to that class). No
--    route ever UPDATEs/DELETEs this table directly -- every lifecycle
--    change goes through the ownership-checked SECURITY DEFINER RPCs --
--    so the policy is narrowed to SELECT + INSERT, and INSERT now also
--    requires teaching the class and starting in LOBBY.
--    sms_gamev2_start_live_session additionally rejects a question
--    order containing any id outside the session's own question set.
--
-- NOTHING HERE WIDENS ACCESS. Every change is a narrowing of an
-- existing grant/policy, or a stricter check inside an existing
-- function. Admin "all" policies are untouched. No legacy sms_game_*
-- object is touched.
-- =====================================================

-- -----------------------------------------------------
-- 1. Reward RPCs: service_role only
-- -----------------------------------------------------
REVOKE ALL ON FUNCTION sms_gamev2_apply_session_rewards(UUID, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sms_gamev2_apply_progression(UUID, INT, INT, INT, DATE, TEXT, INT, NUMERIC, UUID, TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sms_gamev2_apply_daily_challenge_progress(UUID, DATE, TEXT, INT, INT, INT, INT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION sms_gamev2_apply_session_rewards(UUID, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION sms_gamev2_apply_progression(UUID, INT, INT, INT, DATE, TEXT, INT, NUMERIC, UUID, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION sms_gamev2_apply_daily_challenge_progress(UUID, DATE, TEXT, INT, INT, INT, INT) TO service_role;

-- -----------------------------------------------------
-- 2. Server-owned gameplay tables: students read, never write
-- -----------------------------------------------------
DROP POLICY IF EXISTS "gamev2_sessions: student manage own" ON sms_gamev2_sessions;
CREATE POLICY "gamev2_sessions: student read own" ON sms_gamev2_sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_gamev2_sessions.student_id AND s.profile_id = sms_current_user_id())
  );

DROP POLICY IF EXISTS "gamev2_answers: student manage own session" ON sms_gamev2_answers;
CREATE POLICY "gamev2_answers: student read own session" ON sms_gamev2_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_gamev2_sessions sess
      JOIN sms_students s ON s.id = sess.student_id
      WHERE sess.id = sms_gamev2_answers.session_id AND s.profile_id = sms_current_user_id()
    )
  );

DROP POLICY IF EXISTS "gamev2_skill_practice: student manage own" ON sms_gamev2_skill_practice;
CREATE POLICY "gamev2_skill_practice: student read own" ON sms_gamev2_skill_practice
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_gamev2_skill_practice.student_id AND s.profile_id = sms_current_user_id())
  );

DROP POLICY IF EXISTS "gamev2_learning_events: student manage own" ON sms_gamev2_learning_events;
CREATE POLICY "gamev2_learning_events: student read own" ON sms_gamev2_learning_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_gamev2_learning_events.student_id AND s.profile_id = sms_current_user_id())
  );

DROP POLICY IF EXISTS "gamev2_live_participants: student manage own" ON sms_gamev2_live_participants;
CREATE POLICY "gamev2_live_participants: student read own" ON sms_gamev2_live_participants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_gamev2_live_participants.student_id AND s.profile_id = sms_current_user_id())
  );

-- -----------------------------------------------------
-- 3. Answer key: no direct student read of questions
-- -----------------------------------------------------
DROP POLICY IF EXISTS "gamev2_questions: tester read published set" ON sms_gamev2_questions;

-- The set-level (metadata only, no answers) tester policy stays, but
-- only for STUDENT testers -- the population it exists for. A TEACHER
-- tester already reads their own sets and SCHOOL/PUBLIC-shared ones via
-- 073/074's teacher policies; through this policy they could also see
-- another teacher's PRIVATE set the moment it was published, which is
-- exactly what PRIVATE visibility promises not to allow.
DROP POLICY IF EXISTS "gamev2_question_sets: tester read published" ON sms_gamev2_question_sets;
CREATE POLICY "gamev2_question_sets: student tester read published" ON sms_gamev2_question_sets
  FOR SELECT USING (
    published = true
    AND sms_current_role() = 'student'
    AND EXISTS (SELECT 1 FROM sms_gamev2_testers t WHERE t.profile_id = sms_current_user_id())
  );

-- -----------------------------------------------------
-- 6. Live sessions: host may read + create (in LOBBY, for a class
--    they teach); every later change goes through the RPCs
-- -----------------------------------------------------
DROP POLICY IF EXISTS "gamev2_live_sessions: host teacher manage own" ON sms_gamev2_live_sessions;
CREATE POLICY "gamev2_live_sessions: host teacher read own" ON sms_gamev2_live_sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_teachers t WHERE t.id = sms_gamev2_live_sessions.host_teacher_id AND t.profile_id = sms_current_user_id())
  );
CREATE POLICY "gamev2_live_sessions: host teacher create own" ON sms_gamev2_live_sessions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM sms_teachers t WHERE t.id = sms_gamev2_live_sessions.host_teacher_id AND t.profile_id = sms_current_user_id())
    AND sms_teacher_owns_class(sms_gamev2_live_sessions.class_id)
    AND status = 'LOBBY'
  );

-- -----------------------------------------------------
-- 4. Join-code resolver: caller must be the student, and a
--    non-enrolled caller learns nothing
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION sms_gamev2_resolve_live_session_by_join_code(p_join_code TEXT, p_student_id UUID)
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
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sms_students s WHERE s.id = p_student_id AND s.profile_id = sms_current_user_id()
  ) THEN
    RAISE EXCEPTION 'You can only resolve a join code as yourself';
  END IF;

  SELECT * INTO v_session FROM sms_gamev2_live_sessions WHERE join_code = UPPER(p_join_code);

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM sms_class_enrollments ce
    WHERE ce.class_id = v_session.class_id AND ce.student_id = p_student_id AND ce.status = 'active'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT v_session.id, v_session.status, v_session.class_id, v_session.engine_id, v_session.question_set_id, TRUE, v_session.created_at;
END;
$$;

-- -----------------------------------------------------
-- 6b. Start: question order must come from the session's own set
-- -----------------------------------------------------
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

  IF p_question_order IS NULL OR COALESCE(array_length(p_question_order, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Question order must not be empty';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_question_order) AS qid
    WHERE NOT EXISTS (
      SELECT 1 FROM sms_gamev2_questions q WHERE q.id = qid AND q.question_set_id = v_live.question_set_id
    )
  ) THEN
    RAISE EXCEPTION 'Question order contains a question outside this live session''s question set';
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

-- -----------------------------------------------------
-- 5. Make the "not anon" intent of 080-082 real
-- -----------------------------------------------------
REVOKE ALL ON FUNCTION sms_gamev2_start_live_session(UUID, UUID[], UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION sms_gamev2_pause_live_session(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION sms_gamev2_resume_live_session(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION sms_gamev2_end_live_session(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION sms_gamev2_join_active_live_session(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION sms_gamev2_resolve_live_session_by_join_code(TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION sms_gamev2_get_live_race_state(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION sms_gamev2_get_live_boss_battle_state(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION sms_gamev2_question_set_usage_count(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION sms_gamev2_start_live_session(UUID, UUID[], UUID[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sms_gamev2_pause_live_session(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sms_gamev2_resume_live_session(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sms_gamev2_end_live_session(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sms_gamev2_join_active_live_session(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sms_gamev2_resolve_live_session_by_join_code(TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sms_gamev2_get_live_race_state(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sms_gamev2_get_live_boss_battle_state(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sms_gamev2_question_set_usage_count(UUID) TO authenticated, service_role;
