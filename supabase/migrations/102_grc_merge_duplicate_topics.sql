-- =====================================================
-- 102: GAMEROOM CLASSIC -- MERGE THE DUPLICATE TOPICS (ONE-TIME DATA FIX)
--
-- Each of the 12 grammar topics exists twice: an English-named topic with
-- 900 questions (the big CSV upload, for example 04 Paal Gender
-- Classification) and the Tamil-named topic with the first 100 (for
-- example 04 பால்). This moves the questions of each English-named topic
-- into its Tamil-named partner and then removes the empty English-named
-- topic, so each topic shows once with all its questions.
--
-- The Tamil names are kept: three saved games already use those topics.
-- Questions keep their author and everything else; only their topic
-- changes. A topic can be renamed later by the teacher who made it.
--
-- Part 2 then drops the number in front of topic names (01 , 02 , ...).
-- When the name without the number is already a built-in topic (for
-- example திணை), the questions move into that built-in topic instead, so
-- no topic name appears twice; otherwise the topic is simply renamed.
--
-- ISOLATION: touches only GameRoom Classic data (sms_grc_questions,
-- sms_grc_games, sms_grc_categories, and sms_grc_topic_progress if it
-- exists). No table, function or policy is changed.
--
-- Run the whole file in the Supabase SQL editor (nothing selected, then
-- Run). It is all or nothing, and safe to run more than once: a pair that
-- is already merged is skipped. The last statement lists the topics with
-- their question counts so you can check the result.
-- =====================================================

DO $m$
DECLARE
  pair RECORD;
  n INT;
  moved INT := 0;
  games_moved INT := 0;
  removed INT := 0;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('18e7dca3-b825-4a08-81f9-df4650180637'::uuid, 'eb4f1115-21b4-479b-8a38-890e1078b080'::uuid),
      ('d0b9366c-3f5d-469d-8a15-748b6184e5b3'::uuid, '5339daaf-bd5a-4db6-b9d4-0304352787a0'::uuid),
      ('cfc12e25-008d-4127-85f5-b43763f92067'::uuid, '10f58a6a-472f-4160-a939-3368d92955e0'::uuid),
      ('12209fe9-05dc-404f-a00c-95a83733516c'::uuid, 'def4f4a2-9b75-4dc3-893d-ad1bd2bb08d2'::uuid),
      ('8cad72c8-e5f6-4d41-9260-1dad2503b3ce'::uuid, 'd9a05e95-13c3-4ecc-bb85-721cdd83ba15'::uuid),
      ('aaa950ed-329c-4f18-b49c-292a9364626d'::uuid, '5d94b572-9aef-4196-b3d8-68691a87caab'::uuid),
      ('d1cfe2ce-aa70-4026-897a-95d6141403a2'::uuid, '99beaba8-0069-482c-93b7-00d74e8463ba'::uuid),
      ('e17c74cb-d548-4a71-ad97-617872e8b262'::uuid, '45a40469-a7f8-4751-8f10-c3bd15868390'::uuid),
      ('e006dea5-19bf-4608-9aa1-0f1fbb5ef469'::uuid, '632bd060-97c9-4f2c-b0f0-ffac728bbbf8'::uuid),
      ('0f975408-171d-49f3-a6cd-44db66b58815'::uuid, '011ab921-3beb-406a-b38f-2604de57982f'::uuid),
      ('1249d1d3-a2c7-4b1f-a71b-1b269492e644'::uuid, '1ddec521-9549-4025-b5ed-4d39ab05ff4c'::uuid),
      ('b3b7e801-34ac-4cfd-9e53-7aead12fbe26'::uuid, '5482bece-f513-47fa-8bd3-ca87a7e91a4d'::uuid)
    ) AS p(from_id, to_id)
  LOOP
    -- Already merged (the English-named topic is gone): nothing to do.
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM sms_grc_categories WHERE id = pair.from_id);
    IF NOT EXISTS (SELECT 1 FROM sms_grc_categories WHERE id = pair.to_id) THEN
      RAISE EXCEPTION 'GameRoom Classic merge: the Tamil-named topic % is missing, nothing was changed', pair.to_id;
    END IF;

    UPDATE sms_grc_questions SET category_id = pair.to_id WHERE category_id = pair.from_id;
    GET DIAGNOSTICS n = ROW_COUNT;
    moved := moved + n;

    UPDATE sms_grc_games SET category_id = pair.to_id WHERE category_id = pair.from_id;
    GET DIAGNOSTICS n = ROW_COUNT;
    games_moved := games_moved + n;

    -- Student scores per topic (migration 101), if that table exists.
    IF to_regclass('public.sms_grc_topic_progress') IS NOT NULL THEN
      EXECUTE format(
        'INSERT INTO sms_grc_topic_progress AS t (student_id, topic_key, plays, answered, correct, best_percent, last_percent, last_played_at)
         SELECT student_id, %L, plays, answered, correct, best_percent, last_percent, last_played_at FROM sms_grc_topic_progress WHERE topic_key = %L
         ON CONFLICT (student_id, topic_key) DO UPDATE SET
           plays = t.plays + EXCLUDED.plays,
           answered = t.answered + EXCLUDED.answered,
           correct = t.correct + EXCLUDED.correct,
           best_percent = GREATEST(t.best_percent, EXCLUDED.best_percent),
           last_played_at = GREATEST(t.last_played_at, EXCLUDED.last_played_at)',
        pair.to_id::text, pair.from_id::text);
      EXECUTE format('DELETE FROM sms_grc_topic_progress WHERE topic_key = %L', pair.from_id::text);
    END IF;

    DELETE FROM sms_grc_categories WHERE id = pair.from_id;
    GET DIAGNOSTICS n = ROW_COUNT;
    removed := removed + n;
  END LOOP;

  RAISE NOTICE 'GameRoom Classic merge: % questions moved, % games moved, % duplicate topics removed', moved, games_moved, removed;
END $m$;

-- ---- Part 2: no numbers in front of topic names ----
DO $r$
DECLARE
  cat RECORD;
  plain TEXT;
  target UUID;
  n INT;
  renamed INT := 0;
  folded INT := 0;
BEGIN
  FOR cat IN SELECT id, name, owner_id FROM sms_grc_categories WHERE name ~ '^[0-9]+[.)]?\s+' LOOP
    plain := btrim(regexp_replace(cat.name, '^[0-9]+[.)]?\s+', ''));
    CONTINUE WHEN plain = '';
    -- The same name already exists: a built-in topic first, else one of
    -- the same teacher (topic names are unique per teacher).
    SELECT id INTO target FROM sms_grc_categories
      WHERE id <> cat.id AND lower(btrim(name)) = lower(plain) AND (owner_id IS NULL OR owner_id = cat.owner_id)
      ORDER BY (owner_id IS NULL) DESC
      LIMIT 1;

    IF target IS NULL THEN
      UPDATE sms_grc_categories SET name = plain WHERE id = cat.id;
      renamed := renamed + 1;
      CONTINUE;
    END IF;

    UPDATE sms_grc_questions SET category_id = target WHERE category_id = cat.id;
    UPDATE sms_grc_games SET category_id = target WHERE category_id = cat.id;
    IF to_regclass('public.sms_grc_topic_progress') IS NOT NULL THEN
      EXECUTE format(
        'INSERT INTO sms_grc_topic_progress AS t (student_id, topic_key, plays, answered, correct, best_percent, last_percent, last_played_at)
         SELECT student_id, %L, plays, answered, correct, best_percent, last_percent, last_played_at FROM sms_grc_topic_progress WHERE topic_key = %L
         ON CONFLICT (student_id, topic_key) DO UPDATE SET
           plays = t.plays + EXCLUDED.plays,
           answered = t.answered + EXCLUDED.answered,
           correct = t.correct + EXCLUDED.correct,
           best_percent = GREATEST(t.best_percent, EXCLUDED.best_percent),
           last_played_at = GREATEST(t.last_played_at, EXCLUDED.last_played_at)',
        target::text, cat.id::text);
      EXECUTE format('DELETE FROM sms_grc_topic_progress WHERE topic_key = %L', cat.id::text);
    END IF;
    DELETE FROM sms_grc_categories WHERE id = cat.id;
    GET DIAGNOSTICS n = ROW_COUNT;
    folded := folded + n;
  END LOOP;

  RAISE NOTICE 'GameRoom Classic topic names: % renamed, % joined a built-in topic of the same name', renamed, folded;
END $r$;

-- The result: every topic with questions, and how many it has now.
SELECT c.name AS topic, count(q.id) AS questions
FROM sms_grc_categories c
JOIN sms_grc_questions q ON q.category_id = c.id AND q.archived_at IS NULL
GROUP BY c.name
ORDER BY c.name;
