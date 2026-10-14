-- GameRoom Classic co-teacher test (migration 098). Run AFTER 094 to 098
-- are applied, in the Supabase SQL editor (nothing selected, then Run).
-- It ALWAYS rolls back. It finishes by raising one of:
--   'GRC CO-TEACHER TEST PASSED ...'
--   'GRC CO-TEACHER TEST FAILED ...'
-- so nothing it creates is ever kept. It makes its own throw-away test teachers, class and
-- student (grc_test_*); no real accounts are used.

DO $t$
DECLARE
  fails text[] := '{}';
  n int;
  tch1 uuid; tch2 uuid; tch3 uuid; cls uuid; other uuid; stu uuid;
  game uuid; q uuid; asg uuid; att uuid;
BEGIN
  -- ---- Set-up, as the database owner ----
  -- t1 made the assignment; t2 co-teaches the same class; t3 teaches a different class.
  INSERT INTO sms_profiles (id, role, first_name, last_name) VALUES
    ('grc_test_t1', 'teacher', 'Test', 'Owner'), ('grc_test_t2', 'teacher', 'Test', 'CoTeacher'),
    ('grc_test_t3', 'teacher', 'Test', 'Outsider'), ('grc_test_s1', 'student', 'Test', 'Student');
  INSERT INTO sms_teachers (profile_id) VALUES ('grc_test_t1') RETURNING id INTO tch1;
  INSERT INTO sms_teachers (profile_id) VALUES ('grc_test_t2') RETURNING id INTO tch2;
  INSERT INTO sms_teachers (profile_id) VALUES ('grc_test_t3') RETURNING id INTO tch3;
  INSERT INTO sms_classes (name) VALUES ('GRC shared class') RETURNING id INTO cls;
  INSERT INTO sms_classes (name) VALUES ('GRC other class') RETURNING id INTO other;
  INSERT INTO sms_class_teachers (class_id, teacher_id) VALUES (cls, tch1), (cls, tch2), (other, tch3);
  INSERT INTO sms_students (first_name, last_name) VALUES ('Test', 'Pupil') RETURNING id INTO stu;
  INSERT INTO sms_class_enrollments (class_id, student_id) VALUES (cls, stu);
  INSERT INTO sms_grc_questions (owner_id, kind, prompt, payload, content_key) VALUES ('grc_test_t1', 'choice', 'Q', '{"options":["a","b"],"answerIndex":0}', 'k1') RETURNING id INTO q;
  INSERT INTO sms_grc_games (owner_id, title, game_type) VALUES ('grc_test_t1', 'G', 'quiz') RETURNING id INTO game;
  INSERT INTO sms_grc_game_questions VALUES (game, q, 0);
  INSERT INTO sms_grc_assignments (owner_id, game_id, title, game_type, due_at, question_count, total_units) VALUES ('grc_test_t1', game, 'G', 'quiz', now() + interval '1 day', 1, 1) RETURNING id INTO asg;
  INSERT INTO sms_grc_assignment_classes VALUES (asg, cls);
  INSERT INTO sms_grc_assignment_content VALUES (asg, '[]');
  INSERT INTO sms_grc_attempt_grants VALUES (asg, stu, 1);
  INSERT INTO sms_grc_attempts (assignment_id, student_id, attempt_no, play, status, percent) VALUES (asg, stu, 1, '[]', 'submitted', 100) RETURNING id INTO att;
  INSERT INTO sms_grc_responses (attempt_id, question_id, response, correct_units, total_units) VALUES (att, q, '{}', 1, 1);

  EXECUTE 'SET LOCAL ROLE authenticated';

  -- ---- The co-teacher can read everything about it ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_t2","role":"authenticated"}', true);
  SELECT count(*) INTO n FROM sms_grc_assignments WHERE id = asg;
  IF n <> 1 THEN fails := fails || 'co-teacher cannot see the assignment'; END IF;
  SELECT count(*) INTO n FROM sms_grc_assignment_classes WHERE assignment_id = asg;
  IF n <> 1 THEN fails := fails || 'co-teacher cannot see its classes'; END IF;
  SELECT count(*) INTO n FROM sms_grc_assignment_content WHERE assignment_id = asg;
  IF n <> 1 THEN fails := fails || 'co-teacher cannot see its questions'; END IF;
  SELECT count(*) INTO n FROM sms_grc_attempts WHERE assignment_id = asg;
  IF n <> 1 THEN fails := fails || 'co-teacher cannot see attempts'; END IF;
  SELECT count(*) INTO n FROM sms_grc_responses WHERE attempt_id = att;
  IF n <> 1 THEN fails := fails || 'co-teacher cannot see answers'; END IF;
  SELECT count(*) INTO n FROM sms_grc_attempt_grants WHERE assignment_id = asg;
  IF n <> 1 THEN fails := fails || 'co-teacher cannot see extra attempts'; END IF;

  -- ...but cannot change it
  UPDATE sms_grc_assignments SET status = 'closed' WHERE id = asg;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN fails := fails || 'co-teacher closed the assignment'; END IF;
  UPDATE sms_grc_attempt_grants SET extra = 5 WHERE assignment_id = asg;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN fails := fails || 'co-teacher changed extra attempts'; END IF;
  UPDATE sms_grc_attempts SET percent = 0 WHERE id = att;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN fails := fails || 'co-teacher changed a grade'; END IF;
  BEGIN
    INSERT INTO sms_grc_assignment_classes VALUES (asg, other);
    fails := fails || 'co-teacher added a class to the assignment';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ---- The owner still manages it ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_t1","role":"authenticated"}', true);
  UPDATE sms_grc_assignments SET status = 'closed' WHERE id = asg;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN fails := fails || 'owner can no longer close the assignment'; END IF;

  -- ---- A teacher of another class sees nothing ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_t3","role":"authenticated"}', true);
  SELECT (SELECT count(*) FROM sms_grc_assignments) + (SELECT count(*) FROM sms_grc_assignment_content) + (SELECT count(*) FROM sms_grc_attempts) + (SELECT count(*) FROM sms_grc_responses) INTO n;
  IF n <> 0 THEN fails := fails || format('teacher of another class can read %s rows', n); END IF;

  -- ---- Students still have no direct access ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_s1","role":"authenticated"}', true);
  SELECT (SELECT count(*) FROM sms_grc_assignments) + (SELECT count(*) FROM sms_grc_assignment_content) + (SELECT count(*) FROM sms_grc_attempts) INTO n;
  IF n <> 0 THEN fails := fails || format('student can read %s rows directly', n); END IF;
  IF sms_grc_teaches_assignment(asg) THEN fails := fails || 'the helper says a student teaches the assignment'; END IF;

  EXECUTE 'RESET ROLE';
  IF cardinality(fails) = 0 THEN
    RAISE EXCEPTION 'GRC CO-TEACHER TEST PASSED (all rolled back)';
  ELSE
    RAISE EXCEPTION 'GRC CO-TEACHER TEST FAILED (all rolled back): %', array_to_string(fails, ' | ');
  END IF;
END $t$;
