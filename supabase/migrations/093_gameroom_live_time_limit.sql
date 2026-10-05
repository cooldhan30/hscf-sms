-- 093: live games honour the teacher's "time per question".
--
-- The simplified GameRoom home lets a teacher pick 10/15/20/30/60 seconds
-- per question before starting a live game. /api/gameroom-v2/live/host
-- stores it on sms_gamev2_live_sessions.question_time_limit_seconds (the
-- column and its CHECK already exist since migration 079), but the two
-- functions that create each student's own game session never copied
-- it, so every live game ran at the 20-second column default.
--
-- Both functions are re-created unchanged except that the INSERT now
-- carries v_live.question_time_limit_seconds. CREATE OR REPLACE keeps
-- the existing grants (authenticated + service_role).

CREATE OR REPLACE FUNCTION public.sms_gamev2_start_live_session(p_live_session_id uuid, p_question_order uuid[], p_participant_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    INSERT INTO sms_gamev2_sessions (question_set_id, engine_id, student_id, status, question_order, current_index, question_time_limit_seconds)
    VALUES (v_live.question_set_id, v_live.engine_id, v_participant.student_id, 'READY', p_question_order, 0, v_live.question_time_limit_seconds)
    RETURNING id INTO v_new_session_id;

    UPDATE sms_gamev2_live_participants SET session_id = v_new_session_id WHERE id = v_participant.id;
    v_started_count := v_started_count + 1;
  END LOOP;

  UPDATE sms_gamev2_live_sessions
  SET status = 'ACTIVE', question_order = p_question_order, started_at = NOW()
  WHERE id = p_live_session_id;

  RETURN v_started_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sms_gamev2_join_active_live_session(p_live_session_id uuid, p_student_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- existing session id rather than creating a second one.
  IF v_participant.session_id IS NOT NULL THEN
    RETURN v_participant.session_id;
  END IF;

  INSERT INTO sms_gamev2_sessions (question_set_id, engine_id, student_id, status, question_order, current_index, question_time_limit_seconds)
  VALUES (v_live.question_set_id, v_live.engine_id, p_student_id, 'READY', v_live.question_order, 0, v_live.question_time_limit_seconds)
  RETURNING id INTO v_new_session_id;

  UPDATE sms_gamev2_live_participants SET session_id = v_new_session_id WHERE id = v_participant.id;

  RETURN v_new_session_id;
END;
$function$;
