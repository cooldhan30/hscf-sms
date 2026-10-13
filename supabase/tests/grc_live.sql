-- GameRoom Classic live games security test (migration 096). Run AFTER
-- 094, 095 and 096 are applied, in the Supabase SQL editor (nothing
-- selected, then Run). It ALWAYS rolls back: it finishes by raising
-- 'GRC LIVE TEST PASSED ...' or 'GRC LIVE TEST FAILED ...', so nothing it
-- creates is ever kept. It makes its own throw-away test teachers, classes
-- and student (grc_test_*); no real accounts are used.

DO $t$
DECLARE
  fails text[] := '{}';
  n int;
  tch1 uuid; tch2 uuid; cls1 uuid; cls2 uuid; stu uuid;
  game uuid; q uuid; ses uuid;
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

  -- ---- Teacher 1 hosts for their own class ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_t1","role":"authenticated"}', true);
  ses := sms_grc_create_live_session(game, cls1, 'G', 'quiz', '987654', 20, '[{"id":"x"}]'::jsonb, '[{"id":"x"}]'::jsonb, 1);
  SELECT count(*) INTO n FROM sms_grc_live_content WHERE session_id = ses;
  IF n <> 1 THEN fails := fails || 'teacher cannot read own live questions'; END IF;
  BEGIN
    PERFORM sms_grc_create_live_session(game, cls2, 'G', 'quiz', '987655', 20, '[]'::jsonb, '[]'::jsonb, 1);
    fails := fails || 'teacher hosted for another teacher class';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    PERFORM sms_grc_create_live_session(game, cls1, 'G', 'quiz', '987654', 20, '[]'::jsonb, '[]'::jsonb, 1);
    fails := fails || 'two running games got the same PIN';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    PERFORM sms_grc_create_live_session(game, cls1, 'G', 'quiz', '12345', 20, '[]'::jsonb, '[]'::jsonb, 1);
    fails := fails || 'a 5-digit PIN was accepted';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  UPDATE sms_grc_live_sessions SET status = 'question', current_index = 0 WHERE id = ses;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN fails := fails || 'teacher cannot run own live game'; END IF;
  BEGIN
    UPDATE sms_grc_live_sessions SET class_id = cls2 WHERE id = ses;
    fails := fails || 'teacher moved a live game to another teacher class';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    INSERT INTO sms_grc_live_players (session_id, student_id, profile_id, nickname) VALUES (ses, stu, 'grc_test_s1', 'Fake');
    fails := fails || 'teacher wrote a player row';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ---- The server records a player and an answer (owner here) ----
  EXECUTE 'RESET ROLE';
  INSERT INTO sms_grc_live_players (session_id, student_id, profile_id, nickname) VALUES (ses, stu, 'grc_test_s1', 'Test');
  INSERT INTO sms_grc_live_answers (session_id, student_id, question_id, response, correct_units, total_units, points) VALUES (ses, stu, q, '{"kind":"choice","choice":0}', 1, 1, 900);
  BEGIN
    INSERT INTO sms_grc_live_answers (session_id, student_id, question_id, response, correct_units, total_units, points) VALUES (ses, stu, q, '{"kind":"choice","choice":1}', 0, 1, 0);
    fails := fails || 'a second answer to the same question was stored';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  -- Once ended, the PIN can be reused by a new game.
  UPDATE sms_grc_live_sessions SET status = 'ended' WHERE id = ses;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_t1","role":"authenticated"}', true);
  PERFORM sms_grc_create_live_session(game, cls1, 'G', 'quiz', '987654', 20, '[]'::jsonb, '[]'::jsonb, 1);

  SELECT count(*) INTO n FROM sms_grc_live_answers WHERE session_id = ses;
  IF n <> 1 THEN fails := fails || 'teacher cannot see answers in own live game'; END IF;
  UPDATE sms_grc_live_answers SET points = 5000 WHERE session_id = ses;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN fails := fails || 'teacher changed live points'; END IF;

  -- ---- Teacher 2 sees nothing of teacher 1 ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_t2","role":"authenticated"}', true);
  SELECT (SELECT count(*) FROM sms_grc_live_sessions) + (SELECT count(*) FROM sms_grc_live_content) + (SELECT count(*) FROM sms_grc_live_players) + (SELECT count(*) FROM sms_grc_live_answers) INTO n;
  IF n <> 0 THEN fails := fails || format('teacher 2 can read %s rows of teacher 1 live games', n); END IF;
  UPDATE sms_grc_live_sessions SET status = 'ended' WHERE owner_id = 'grc_test_t1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN fails := fails || 'teacher 2 controlled teacher 1 live game'; END IF;

  -- ---- Students have no direct access (answer keys stay hidden) ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_s1","role":"authenticated"}', true);
  SELECT (SELECT count(*) FROM sms_grc_live_sessions) + (SELECT count(*) FROM sms_grc_live_content) + (SELECT count(*) FROM sms_grc_live_players) + (SELECT count(*) FROM sms_grc_live_answers) INTO n;
  IF n <> 0 THEN fails := fails || format('student can read %s live rows directly', n); END IF;
  BEGIN
    INSERT INTO sms_grc_live_answers (session_id, student_id, question_id, response, correct_units, total_units, points) VALUES (ses, stu, gen_random_uuid(), '{}', 1, 1, 1000);
    fails := fails || 'student wrote a live answer directly';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    PERFORM sms_grc_create_live_session(game, cls1, 'G', 'quiz', '987656', 20, '[]'::jsonb, '[]'::jsonb, 1);
    fails := fails || 'student hosted a live game';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ---- Admins read but do not change ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_a1","role":"authenticated"}', true);
  SELECT count(*) INTO n FROM sms_grc_live_answers WHERE session_id = ses;
  IF n <> 1 THEN fails := fails || 'admin cannot read live answers'; END IF;
  UPDATE sms_grc_live_sessions SET status = 'lobby' WHERE id = ses;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN fails := fails || 'admin changed a live game'; END IF;

  -- ---- Signed-out visitors see nothing ----
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT (SELECT count(*) FROM sms_grc_live_sessions) + (SELECT count(*) FROM sms_grc_live_players) INTO n;
  IF n <> 0 THEN fails := fails || 'signed-out visitor can read live games'; END IF;

  EXECUTE 'RESET ROLE';
  IF cardinality(fails) = 0 THEN
    RAISE EXCEPTION 'GRC LIVE TEST PASSED (all rolled back)';
  ELSE
    RAISE EXCEPTION 'GRC LIVE TEST FAILED (all rolled back): %', array_to_string(fails, ' | ');
  END IF;
END $t$;
