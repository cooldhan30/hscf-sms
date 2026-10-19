-- =====================================================
-- 104: GAMEROOM CLASSIC -- FAST QUESTION LIBRARY PAGES
--
-- The Question Library now loads one page of questions at a time, newest
-- first, for one question type. This index matches that order, so each
-- page is found without sorting the whole library.
--
-- ISOLATION: touches only GameRoom Classic. Adds one index on
-- sms_grc_questions. No table, row, function or policy is changed.
--
-- Run the whole file in the Supabase SQL editor (nothing selected, then
-- Run). Safe to run more than once.
--
-- Rollback: DROP INDEX IF EXISTS idx_sms_grc_questions_library_order;
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_sms_grc_questions_library_order
  ON sms_grc_questions (kind, updated_at DESC, id) WHERE archived_at IS NULL;
