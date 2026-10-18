-- =====================================================
-- 099: GAMEROOM CLASSIC -- ONE QUESTION LIBRARY SHARED BY ALL TEACHERS
--
-- Every teacher can now see and use the questions and topics of every teacher
-- in their own games. Only the teacher who wrote a question can still
-- edit or archive it (the 094 "manage own" policies are unchanged), so
-- nobody can change the games and assignments another teacher built.
--
-- ISOLATION: touches only GameRoom Classic. Adds two read-only (SELECT)
-- policies on 094 sms_grc_* tables and replaces the 094 trigger function
-- sms_grc_check_game_question() so a game may use a question by any teacher
-- (it still refuses questions that do not fit the game type). No other
-- table, function, policy or row is changed.
--
-- Run the whole file in the Supabase SQL editor (nothing selected, then
-- Run). Safe to run more than once.
--
-- Rollback: drop the two policies below and re-run the 094 version of
-- sms_grc_check_game_question() (games that already use another teacher
-- question keep working; only new ones are refused).
-- =====================================================

DROP POLICY IF EXISTS "grc_questions: teacher read all" ON sms_grc_questions;
CREATE POLICY "grc_questions: teacher read all" ON sms_grc_questions
  FOR SELECT USING (sms_current_role() = 'teacher');

DROP POLICY IF EXISTS "grc_categories: teacher read all" ON sms_grc_categories;
CREATE POLICY "grc_categories: teacher read all" ON sms_grc_categories
  FOR SELECT USING (sms_current_role() = 'teacher');

-- A game may hold any question the caller can see (now: any teacher
-- question), but only of the kind its game type plays. Runs as the
-- caller, so RLS still applies: the game itself must be the caller own
-- game (enforced by the sms_grc_game_questions policy) and the question
-- must be visible to them.
CREATE OR REPLACE FUNCTION sms_grc_check_game_question()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_game sms_grc_games%ROWTYPE;
  v_question sms_grc_questions%ROWTYPE;
  v_expected TEXT := 'order';
BEGIN
  SELECT * INTO v_game FROM sms_grc_games WHERE id = NEW.game_id;
  SELECT * INTO v_question FROM sms_grc_questions WHERE id = NEW.question_id;
  IF v_game.id IS NULL OR v_question.id IS NULL THEN
    RAISE EXCEPTION 'GameRoom Classic: that question is not available';
  END IF;
  IF v_game.game_type = 'quiz' THEN
    v_expected := 'choice';
  ELSIF v_game.game_type = 'match' THEN
    v_expected := 'match';
  END IF;
  IF v_question.kind <> v_expected THEN
    RAISE EXCEPTION 'GameRoom Classic: this question type does not fit a % game', v_game.game_type;
  END IF;
  RETURN NEW;
END;
$fn$;
