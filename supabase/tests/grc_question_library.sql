-- GameRoom Classic question library security test (migration 094). Run
-- AFTER 094 is applied, e.g. in the Supabase SQL editor. It ALWAYS rolls
-- back: it finishes by raising 'GRC LIBRARY TEST PASSED ...' or
-- 'GRC LIBRARY TEST FAILED ...', so nothing it creates is ever kept.
-- It makes its own throw-away test profiles (grc_test_*); no real
-- accounts are used.
INSERT INTO sms_profiles (id, role, first_name, last_name) VALUES
  ('grc_test_t1', 'teacher', 'Test', 'TeacherOne'), ('grc_test_t2', 'teacher', 'Test', 'TeacherTwo'),
  ('grc_test_s1', 'student', 'Test', 'Student'), ('grc_test_a1', 'admin', 'Test', 'Admin');

DO $t$
DECLARE
  fails text[] := '{}';
  n int;
  ids uuid[];
  cat uuid; q1 uuid; q2 uuid; q_order uuid; g1 uuid; q_t2 uuid; g2 uuid;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- ---- Teacher 1 builds a library ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_t1","role":"authenticated"}', true);
  SELECT count(*) INTO n FROM sms_grc_categories WHERE owner_id IS NULL;
  IF n <> 19 THEN fails := fails || format('teacher sees %s starter topics, expected 19', n); END IF;
  INSERT INTO sms_grc_categories (name, owner_id) VALUES ('My topic', 'grc_test_t1') RETURNING id INTO cat;
  INSERT INTO sms_grc_questions (owner_id, kind, category_id, prompt, payload, content_key) VALUES ('grc_test_t1', 'choice', cat, 'Q1', '{"options":["a","b"],"answerIndex":0}', 'k1') RETURNING id INTO q1;
  INSERT INTO sms_grc_questions (owner_id, kind, prompt, payload, content_key) VALUES ('grc_test_t1', 'choice', 'Q2', '{"options":["a","b"],"answerIndex":1}', 'k3') RETURNING id INTO q2;
  INSERT INTO sms_grc_questions (owner_id, kind, prompt, payload, content_key) VALUES ('grc_test_t1', 'order', 'Q3', '{"unit":"letters","answer":"அம்மா"}', 'k2') RETURNING id INTO q_order;

  -- Saving a game keeps the chosen order
  g1 := sms_grc_save_game(NULL, 'G1', 'quiz', cat, 'easy', 20, ARRAY[q2, q1]);
  SELECT array_agg(question_id ORDER BY position) INTO ids FROM sms_grc_game_questions WHERE game_id = g1;
  IF ids IS DISTINCT FROM ARRAY[q2, q1] THEN fails := fails || 'saved question order is wrong'; END IF;

  -- A failed save changes nothing (wrong question type in a quiz)
  BEGIN
    PERFORM sms_grc_save_game(g1, 'G1 renamed', 'quiz', cat, 'easy', 20, ARRAY[q1, q_order]);
    fails := fails || 'a word-builder question was accepted in a quiz';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  SELECT count(*) INTO n FROM sms_grc_game_questions WHERE game_id = g1;
  IF n <> 2 THEN fails := fails || format('failed save left %s questions, expected the original 2', n); END IF;
  SELECT count(*) INTO n FROM sms_grc_games WHERE id = g1 AND title = 'G1';
  IF n <> 1 THEN fails := fails || 'failed save renamed the game'; END IF;

  BEGIN
    PERFORM sms_grc_save_game(NULL, 'Empty', 'quiz', NULL, 'easy', 20, ARRAY[]::uuid[]);
    fails := fails || 'a game with no questions was saved';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    PERFORM sms_grc_save_game(g1, 'G1', 'match', cat, 'easy', 20, ARRAY[q1]);
    fails := fails || 'a game changed type';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Duplicates blocked; an archived question can be added again
  BEGIN
    INSERT INTO sms_grc_questions (owner_id, kind, prompt, payload, content_key) VALUES ('grc_test_t1', 'choice', 'Q1 again', '{}', 'k1');
    fails := fails || 'a duplicate question was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  UPDATE sms_grc_questions SET archived_at = now() WHERE id = q_order;
  INSERT INTO sms_grc_questions (owner_id, kind, prompt, payload, content_key) VALUES ('grc_test_t1', 'order', 'Q3', '{"unit":"letters","answer":"அம்மா"}', 'k2');

  -- Cannot write as someone else, or create/rename starter topics
  BEGIN
    INSERT INTO sms_grc_questions (owner_id, kind, prompt, payload, content_key) VALUES ('grc_test_t2', 'choice', 'X', '{}', 'k9');
    fails := fails || 'teacher wrote a question as another teacher';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    INSERT INTO sms_grc_categories (name) VALUES ('Fake starter');
    fails := fails || 'teacher created a starter topic';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  UPDATE sms_grc_categories SET name = 'renamed' WHERE owner_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN fails := fails || format('teacher renamed %s starter topics', n); END IF;

  -- ---- Teacher 2 cannot see or touch the work of teacher 1 ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_t2","role":"authenticated"}', true);
  SELECT count(*) INTO n FROM sms_grc_questions;
  IF n <> 0 THEN fails := fails || format('teacher 2 sees %s of teacher 1''s questions', n); END IF;
  SELECT count(*) INTO n FROM sms_grc_games;
  IF n <> 0 THEN fails := fails || format('teacher 2 sees %s of teacher 1''s games', n); END IF;
  SELECT count(*) INTO n FROM sms_grc_game_questions;
  IF n <> 0 THEN fails := fails || 'teacher 2 sees teacher 1''s game contents'; END IF;
  SELECT count(*) INTO n FROM sms_grc_categories WHERE owner_id IS NOT NULL;
  IF n <> 0 THEN fails := fails || 'teacher 2 sees teacher 1''s topics'; END IF;
  UPDATE sms_grc_questions SET prompt = 'changed' WHERE id = q1;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN fails := fails || 'teacher 2 edited teacher 1''s question'; END IF;
  DELETE FROM sms_grc_games WHERE id = g1;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN fails := fails || 'teacher 2 deleted teacher 1''s game'; END IF;
  BEGIN
    PERFORM sms_grc_save_game(g1, 'Hijacked', 'quiz', NULL, 'easy', 20, ARRAY[q1]);
    fails := fails || 'teacher 2 re-saved teacher 1''s game';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  INSERT INTO sms_grc_questions (owner_id, kind, prompt, payload, content_key) VALUES ('grc_test_t2', 'choice', 'Mine', '{"options":["a","b"],"answerIndex":1}', 'k1') RETURNING id INTO q_t2;
  BEGIN
    PERFORM sms_grc_save_game(NULL, 'G2', 'quiz', NULL, 'easy', 20, ARRAY[q_t2, q1]);
    fails := fails || 'teacher 2 used teacher 1''s question in a game';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  g2 := sms_grc_save_game(NULL, 'G2', 'quiz', NULL, 'easy', 20, ARRAY[q_t2]);
  BEGIN
    INSERT INTO sms_grc_game_questions VALUES (g1, q_t2, 5);
    fails := fails || 'teacher 2 added a question to teacher 1''s game';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ---- Students see nothing and cannot write ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_s1","role":"authenticated"}', true);
  SELECT (SELECT count(*) FROM sms_grc_questions) + (SELECT count(*) FROM sms_grc_games) + (SELECT count(*) FROM sms_grc_game_questions) + (SELECT count(*) FROM sms_grc_categories) INTO n;
  IF n <> 0 THEN fails := fails || format('student can read %s library rows (answer keys!)', n); END IF;
  BEGIN
    INSERT INTO sms_grc_questions (owner_id, kind, prompt, payload, content_key) VALUES ('grc_test_s1', 'choice', 'X', '{}', 'k5');
    fails := fails || 'student wrote a question';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    PERFORM sms_grc_save_game(NULL, 'S', 'quiz', NULL, 'easy', 20, ARRAY[q1]);
    fails := fails || 'student saved a game';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ---- Admins can read but not change ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_a1","role":"authenticated"}', true);
  SELECT count(*) INTO n FROM sms_grc_questions WHERE owner_id LIKE 'grc_test_%';
  IF n < 4 THEN fails := fails || format('admin reads only %s test questions', n); END IF;
  UPDATE sms_grc_questions SET prompt = 'admin edit' WHERE owner_id LIKE 'grc_test_%';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN fails := fails || 'admin edited teachers'' questions'; END IF;

  -- ---- Signed-out visitors see nothing ----
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT (SELECT count(*) FROM sms_grc_questions) + (SELECT count(*) FROM sms_grc_categories) INTO n;
  IF n <> 0 THEN fails := fails || 'signed-out visitor can read library rows'; END IF;

  EXECUTE 'RESET ROLE';
  IF cardinality(fails) = 0 THEN
    RAISE EXCEPTION 'GRC LIBRARY TEST PASSED (all rolled back)';
  ELSE
    RAISE EXCEPTION 'GRC LIBRARY TEST FAILED (all rolled back): %', array_to_string(fails, ' | ');
  END IF;
END $t$;
