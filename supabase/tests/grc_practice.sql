-- GameRoom Classic practice security test (migration 097). Run AFTER 094
-- to 097 are applied, in the Supabase SQL editor (nothing selected, then
-- Run). It ALWAYS rolls back: it finishes by raising
-- 'GRC PRACTICE TEST PASSED ...' or 'GRC PRACTICE TEST FAILED ...', so
-- nothing it creates is ever kept. It makes its own throw-away test
-- teachers and student (grc_test_*); no real accounts are used.

DO $t$
DECLARE
  fails text[] := '{}';
  n int;
  stu uuid; game uuid;
BEGIN
  -- ---- Set-up, as the database owner ----
  INSERT INTO sms_profiles (id, role, first_name, last_name) VALUES
    ('grc_test_t1', 'teacher', 'Test', 'TeacherOne'), ('grc_test_t2', 'teacher', 'Test', 'TeacherTwo'),
    ('grc_test_s1', 'student', 'Test', 'Student'), ('grc_test_a1', 'admin', 'Test', 'Admin');
  INSERT INTO sms_students (first_name, last_name) VALUES ('Test', 'Pupil') RETURNING id INTO stu;
  INSERT INTO sms_grc_games (owner_id, title, game_type) VALUES ('grc_test_t1', 'G', 'quiz') RETURNING id INTO game;
  SELECT count(*) INTO n FROM sms_grc_games WHERE id = game AND practice;
  IF n <> 1 THEN fails := fails || 'new games are not open for practice by default'; END IF;
  -- The server records practice progress.
  INSERT INTO sms_grc_practice_progress (student_id, game_id, plays, best_percent, last_percent) VALUES (stu, game, 1, 80, 80);
  BEGIN
    INSERT INTO sms_grc_practice_progress (student_id, game_id, plays, best_percent, last_percent) VALUES (stu, game, 1, 150, 150);
    fails := fails || 'a practice score above 100 was accepted';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  EXECUTE 'SET LOCAL ROLE authenticated';

  -- ---- Teacher 1 switches practice and reads progress on own game ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_t1","role":"authenticated"}', true);
  UPDATE sms_grc_games SET practice = false WHERE id = game;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN fails := fails || 'teacher cannot switch practice on own game'; END IF;
  SELECT count(*) INTO n FROM sms_grc_practice_progress WHERE game_id = game;
  IF n <> 1 THEN fails := fails || 'teacher cannot see practice progress on own game'; END IF;
  UPDATE sms_grc_practice_progress SET best_percent = 100 WHERE game_id = game;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN fails := fails || 'teacher changed a practice score'; END IF;

  -- ---- Teacher 2 cannot touch it ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_t2","role":"authenticated"}', true);
  UPDATE sms_grc_games SET practice = true WHERE id = game;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN fails := fails || 'teacher 2 switched practice on teacher 1 game'; END IF;
  SELECT count(*) INTO n FROM sms_grc_practice_progress;
  IF n <> 0 THEN fails := fails || 'teacher 2 can see practice progress on teacher 1 game'; END IF;

  -- ---- Students have no direct access ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_s1","role":"authenticated"}', true);
  SELECT (SELECT count(*) FROM sms_grc_practice_progress) + (SELECT count(*) FROM sms_grc_games) INTO n;
  IF n <> 0 THEN fails := fails || format('student can read %s rows directly', n); END IF;
  BEGIN
    INSERT INTO sms_grc_practice_progress (student_id, game_id, plays, best_percent, last_percent) VALUES (stu, game, 1, 100, 100);
    fails := fails || 'student wrote practice progress directly';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ---- Admins read but do not change ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_a1","role":"authenticated"}', true);
  SELECT count(*) INTO n FROM sms_grc_practice_progress WHERE game_id = game;
  IF n <> 1 THEN fails := fails || 'admin cannot read practice progress'; END IF;
  UPDATE sms_grc_practice_progress SET plays = 99 WHERE game_id = game;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN fails := fails || 'admin changed practice progress'; END IF;

  -- ---- Signed-out visitors see nothing ----
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT count(*) INTO n FROM sms_grc_practice_progress;
  IF n <> 0 THEN fails := fails || 'signed-out visitor can read practice progress'; END IF;

  EXECUTE 'RESET ROLE';
  IF cardinality(fails) = 0 THEN
    RAISE EXCEPTION 'GRC PRACTICE TEST PASSED (all rolled back)';
  ELSE
    RAISE EXCEPTION 'GRC PRACTICE TEST FAILED (all rolled back): %', array_to_string(fails, ' | ');
  END IF;
END $t$;
