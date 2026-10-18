-- =====================================================
-- 100: GAMEROOM CLASSIC -- ANY TEACHER CAN EDIT THE SHARED LIBRARY
--
-- Builds on 099 (run 099 first). Any teacher can now edit or archive any
-- question in the shared library, not only the questions they wrote.
-- A question still keeps its author (owner_id) and its type (kind): a
-- trigger stops an edit from changing either one. Topics are unchanged
-- (only the teacher who made a topic can rename it).
--
-- ISOLATION: touches only GameRoom Classic. Adds one UPDATE policy on
-- sms_grc_questions and one trigger with its function. No other table,
-- function, policy or row is changed.
--
-- Run the whole file in the Supabase SQL editor (nothing selected, then
-- Run). Safe to run more than once.
--
-- Rollback:
--   DROP POLICY IF EXISTS "grc_questions: teacher edit all" ON sms_grc_questions;
--   DROP TRIGGER IF EXISTS trg_sms_grc_questions_keep_author ON sms_grc_questions;
--   DROP FUNCTION IF EXISTS sms_grc_keep_question_author();
-- =====================================================

DROP POLICY IF EXISTS "grc_questions: teacher edit all" ON sms_grc_questions;
CREATE POLICY "grc_questions: teacher edit all" ON sms_grc_questions
  FOR UPDATE USING (sms_current_role() = 'teacher')
  WITH CHECK (sms_current_role() = 'teacher');

-- An edit never changes who wrote a question or what type it is.
CREATE OR REPLACE FUNCTION sms_grc_keep_question_author()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.owner_id := OLD.owner_id;
  NEW.kind := OLD.kind;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_sms_grc_questions_keep_author ON sms_grc_questions;
CREATE TRIGGER trg_sms_grc_questions_keep_author BEFORE UPDATE ON sms_grc_questions
  FOR EACH ROW EXECUTE FUNCTION sms_grc_keep_question_author();
