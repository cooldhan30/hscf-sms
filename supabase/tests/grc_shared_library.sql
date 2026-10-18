-- GameRoom Classic shared library test (migrations 099 and 100). Run AFTER
-- 094 to 100 are applied, in the Supabase SQL editor (nothing selected, then Run).
-- It ALWAYS rolls back. It finishes by raising one of:
--   'GRC SHARED LIBRARY TEST PASSED ...'
--   'GRC SHARED LIBRARY TEST FAILED ...'
-- so nothing it creates is ever kept. It makes its own throw-away test
-- teachers and student (grc_test_*); no real accounts are used.

DO $t$
DECLARE
  fails text[] := '{}';
  n int;
  cat uuid; q_choice uuid; q_order uuid; g2 uuid;
BEGIN
  INSERT INTO sms_profiles (id, role, first_name, last_name) VALUES
    ('grc_test_t1', 'teacher', 'Test', 'Author'), ('grc_test_t2', 'teacher', 'Test', 'Borrower'),
    ('grc_test_s1', 'student', 'Test', 'Student');

  EXECUTE 'SET LOCAL ROLE authenticated';

  -- ---- Teacher 1 writes a topic and two questions ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_t1","role":"authenticated"}', true);
  INSERT INTO sms_grc_categories (name, owner_id) VALUES ('Shared topic', 'grc_test_t1') RETURNING id INTO cat;
  INSERT INTO sms_grc_questions (owner_id, kind, category_id, prompt, payload, content_key) VALUES ('grc_test_t1', 'choice', cat, 'Q1', '{"options":["a","b"],"answerIndex":0}', 'k1') RETURNING id INTO q_choice;
  INSERT INTO sms_grc_questions (owner_id, kind, prompt, payload, content_key) VALUES ('grc_test_t1', 'order', 'Q2', '{"unit":"letters","answer":"அம்மா"}', 'k2') RETURNING id INTO q_order;

  -- ---- Teacher 2 sees them and uses them in their own game ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_t2","role":"authenticated"}', true);
  SELECT count(*) INTO n FROM sms_grc_questions WHERE owner_id = 'grc_test_t1';
  IF n <> 2 THEN fails := fails || format('teacher 2 sees %s of teacher 1 questions, expected 2', n); END IF;
  SELECT count(*) INTO n FROM sms_grc_categories WHERE id = cat;
  IF n <> 1 THEN fails := fails || 'teacher 2 cannot see the shared topic'; END IF;
  BEGIN
    g2 := sms_grc_save_game(NULL, 'Borrowed', 'quiz', cat, 'easy', 20, ARRAY[q_choice]);
  EXCEPTION WHEN OTHERS THEN
    fails := fails || ('teacher 2 cannot use a shared question: ' || SQLERRM);
  END;
  BEGIN
    PERFORM sms_grc_save_game(NULL, 'Wrong kind', 'quiz', NULL, 'easy', 20, ARRAY[q_order]);
    fails := fails || 'a word-builder question was accepted in a quiz';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ...and can edit them (100), but an edit keeps the author and the type
  UPDATE sms_grc_questions SET prompt = 'changed', owner_id = 'grc_test_t2', kind = 'match' WHERE id = q_choice;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN fails := fails || 'teacher 2 cannot edit teacher 1 question'; END IF;
  SELECT count(*) INTO n FROM sms_grc_questions WHERE id = q_choice AND prompt = 'changed' AND owner_id = 'grc_test_t1' AND kind = 'choice';
  IF n <> 1 THEN fails := fails || 'an edit changed the author or the type, or did not save'; END IF;
  UPDATE sms_grc_questions SET archived_at = now() WHERE id = q_order;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN fails := fails || 'teacher 2 cannot archive teacher 1 question'; END IF;
  -- Deleting outright and renaming the topic stay with the author
  DELETE FROM sms_grc_questions WHERE id = q_choice;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN fails := fails || 'teacher 2 deleted teacher 1 question'; END IF;
  UPDATE sms_grc_categories SET name = 'renamed' WHERE id = cat;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN fails := fails || 'teacher 2 renamed teacher 1 topic'; END IF;
  -- Games stay private to their teacher
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_t1","role":"authenticated"}', true);
  SELECT count(*) INTO n FROM sms_grc_games WHERE owner_id = 'grc_test_t2';
  IF n <> 0 THEN fails := fails || 'teacher 1 can see teacher 2 games'; END IF;

  -- ---- Students and signed-out visitors still see nothing ----
  PERFORM set_config('request.jwt.claims', '{"sub":"grc_test_s1","role":"authenticated"}', true);
  SELECT (SELECT count(*) FROM sms_grc_questions) + (SELECT count(*) FROM sms_grc_categories) INTO n;
  IF n <> 0 THEN fails := fails || format('student can read %s library rows (answer keys!)', n); END IF;
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT count(*) INTO n FROM sms_grc_questions;
  IF n <> 0 THEN fails := fails || 'signed-out visitor can read questions'; END IF;

  EXECUTE 'RESET ROLE';
  IF cardinality(fails) = 0 THEN
    RAISE EXCEPTION 'GRC SHARED LIBRARY TEST PASSED (all rolled back)';
  ELSE
    RAISE EXCEPTION 'GRC SHARED LIBRARY TEST FAILED (all rolled back): %', array_to_string(fails, ' | ');
  END IF;
END $t$;
