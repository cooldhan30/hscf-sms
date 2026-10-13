-- GameRoom Classic assignments security test (migration 095). Run AFTER
-- 094 and 095 are applied, in the Supabase SQL editor (nothing selected,
-- then Run). It ALWAYS rolls back: it finishes by raising
-- 'GRC ASSIGNMENTS TEST PASSED ...' or 'GRC ASSIGNMENTS TEST FAILED ...',
-- so nothing it creates is ever kept. It makes its own throw-away test
-- teachers, classes and student (grc_test_*); no real accounts are used.

DO $t$
DECLARE
  fails text[] := '{}';
  n int;
  tch1 uuid; tch2 uuid; cls1 uuid; cls2 uuid; stu uuid;
  game uuid; q uuid; asg uuid; att uuid;
BEGIN
  -- ---- Set-up, as the database owner ----
  INSERT INTO sms_profiles (id, role, first_name, last_name) VALUES
    ('grc_test_t1', 'teacher', 'Test', 'TeacherOne'), ('grc_test_t2', 'teacher', 'Test', 'TeacherTwo'),
    ('grc_test_s1', 'student', 'Test', 'Student'), ('grc_test_a1', 'admin', 'Test', 'Admin');
  INSERT INTO sms_teachers (profile_id) VALUES ('grc_test_t1') RETURNING id INTO tch1;
  INSERT INTO sms_teachers (profile_id) VALUES ('grc_test_t2') RETURNING id INTO tch2;
  INSERT INTO sms_classes (name) VALUES ('GRC test class one') RETURNING id INTO cls1;
  INSERT INTO sms_classes (name) VALUES ('GRC test class two') RETURNING id INTO cls2;
  INSERT INTO sms_class_teachers (class_id, teacher_id) VALUES (cls1, tch1), (cls2, tch2);
  INSERT INTO sms_students (first_name, last_name) VALUES ('Test', 'Pupil') RETURNING id INTO stu;
  INSERT INTO sms_class_enrollments (class_id, student_id) VALUES (cls1, stu);
  INSERT INTO sms_grc_questions (owner_id, kind, prompt, payload, content_key) VALUES ('grc_test_t1', 'choice', 'Q', '{"options":["a","b"],"answerIndex":0}', 'k1') RETURNING id INTO q;
  INSERT INTO sms_grc_games (owner_id, title, game_type) VALUES ('grc_test_t1', 'G', 'quiz') RETURNING id INTO game;
  INSERT INTO sms_grc_game_questions VALUES (game, q, 0);

  EXECUTE 'SET LOCAL ROLE authenticated';

  -- ---- Teacher 1 publishes to their own class ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_t1","role":"authenticated"}', true);
  asg := sms_grc_publish_assignment(game, 'G', 'quiz', ARRAY[cls1], now() + interval '2 days', 2, NULL, NULL, true, false, 'after-due', 'best', '[{"id":"x"}]'::jsonb, 1, 1);
  SELECT count(*) INTO n FROM sms_grc_assignment_classes WHERE assignment_id = asg;
  IF n <> 1 THEN fails := fails || 'publish did not link the class'; END IF;
  SELECT count(*) INTO n FROM sms_grc_assignment_content WHERE assignment_id = asg;
  IF n <> 1 THEN fails := fails || 'teacher cannot read own assignment questions'; END IF;

  -- Not to a class they do not teach, and a failed publish leaves nothing behind
  BEGIN
    PERFORM sms_grc_publish_assignment(game, 'G', 'quiz', ARRAY[cls1, cls2], now() + interval '2 days', 2, NULL, NULL, true, false, 'after-due', 'best', '[]'::jsonb, 1, 1);
    fails := fails || 'teacher assigned a game to another teacher class';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  SELECT count(*) INTO n FROM sms_grc_assignments;
  IF n <> 1 THEN fails := fails || format('failed publish left %s assignments, expected 1', n); END IF;
  BEGIN
    INSERT INTO sms_grc_assignment_classes VALUES (asg, cls2);
    fails := fails || 'teacher added another teacher class to an assignment';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Teachers cannot write attempts or grades
  BEGIN
    INSERT INTO sms_grc_attempts (assignment_id, student_id, attempt_no, play) VALUES (asg, stu, 1, '[]');
    fails := fails || 'teacher created a student attempt';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ---- The server records an attempt (service role = owner here) ----
  EXECUTE 'RESET ROLE';
  INSERT INTO sms_grc_attempts (assignment_id, student_id, attempt_no, play) VALUES (asg, stu, 1, '[]') RETURNING id INTO att;
  INSERT INTO sms_grc_responses (attempt_id, question_id, response, correct_units, total_units) VALUES (att, q, '{"kind":"choice","choice":0}', 1, 1);
  BEGIN
    INSERT INTO sms_grc_attempts (assignment_id, student_id, attempt_no, play) VALUES (asg, stu, 2, '[]');
    fails := fails || 'two unfinished attempts allowed for one student';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- Teacher 1 reads the results but cannot change a grade
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_t1","role":"authenticated"}', true);
  SELECT count(*) INTO n FROM sms_grc_attempts WHERE assignment_id = asg;
  IF n <> 1 THEN fails := fails || 'teacher cannot see attempts on own assignment'; END IF;
  SELECT count(*) INTO n FROM sms_grc_responses WHERE attempt_id = att;
  IF n <> 1 THEN fails := fails || 'teacher cannot see answers on own assignment'; END IF;
  UPDATE sms_grc_attempts SET percent = 100 WHERE id = att;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN fails := fails || 'teacher changed a student grade'; END IF;
  INSERT INTO sms_grc_attempt_grants (assignment_id, student_id, extra) VALUES (asg, stu, 1);

  -- ---- Teacher 2 sees nothing of teacher 1 ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_t2","role":"authenticated"}', true);
  SELECT (SELECT count(*) FROM sms_grc_assignments) + (SELECT count(*) FROM sms_grc_assignment_content) + (SELECT count(*) FROM sms_grc_assignment_classes)
       + (SELECT count(*) FROM sms_grc_attempts) + (SELECT count(*) FROM sms_grc_responses) + (SELECT count(*) FROM sms_grc_attempt_grants) INTO n;
  IF n <> 0 THEN fails := fails || format('teacher 2 can read %s rows of teacher 1 assignments', n); END IF;
  UPDATE sms_grc_assignments SET status = 'closed' WHERE id = asg;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN fails := fails || 'teacher 2 closed teacher 1 assignment'; END IF;
  BEGIN
    INSERT INTO sms_grc_attempt_grants (assignment_id, student_id, extra) VALUES (asg, stu, 5);
    fails := fails || 'teacher 2 granted attempts on teacher 1 assignment';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ---- Students have no direct access at all (answer keys stay hidden) ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_s1","role":"authenticated"}', true);
  SELECT (SELECT count(*) FROM sms_grc_assignments) + (SELECT count(*) FROM sms_grc_assignment_content) + (SELECT count(*) FROM sms_grc_attempts) + (SELECT count(*) FROM sms_grc_responses) INTO n;
  IF n <> 0 THEN fails := fails || format('student can read %s assignment rows directly', n); END IF;
  BEGIN
    INSERT INTO sms_grc_attempts (assignment_id, student_id, attempt_no, play) VALUES (asg, stu, 3, '[]');
    fails := fails || 'student wrote an attempt directly';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    PERFORM sms_grc_publish_assignment(game, 'G', 'quiz', ARRAY[cls1], now() + interval '2 days', 2, NULL, NULL, true, false, 'after-due', 'best', '[]'::jsonb, 1, 1);
    fails := fails || 'student published an assignment';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ---- Admins read but do not change ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_a1","role":"authenticated"}', true);
  SELECT count(*) INTO n FROM sms_grc_attempts WHERE id = att;
  IF n <> 1 THEN fails := fails || 'admin cannot read attempts'; END IF;
  UPDATE sms_grc_attempts SET percent = 0 WHERE id = att;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN fails := fails || 'admin changed a grade'; END IF;

  -- ---- Signed-out visitors see nothing ----
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT (SELECT count(*) FROM sms_grc_assignments) + (SELECT count(*) FROM sms_grc_attempts) INTO n;
  IF n <> 0 THEN fails := fails || 'signed-out visitor can read assignments'; END IF;

  EXECUTE 'RESET ROLE';
  IF cardinality(fails) = 0 THEN
    RAISE EXCEPTION 'GRC ASSIGNMENTS TEST PASSED (all rolled back)';
  ELSE
    RAISE EXCEPTION 'GRC ASSIGNMENTS TEST FAILED (all rolled back): %', array_to_string(fails, ' | ');
  END IF;
END $t$;
