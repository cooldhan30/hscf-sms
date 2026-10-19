-- =====================================================
-- 103: GAMEROOM CLASSIC -- FAST TOPIC COUNTS
--
-- The topic pages (Quick live game, Play Offline, Assign) show how many
-- questions each topic has. With tens of thousands of questions, reading
-- every row to count them made the pages slow. This view counts them in
-- the database (one row per topic and question type), and the index lets
-- a game pick the questions of a topic quickly.
--
-- ISOLATION: touches only GameRoom Classic. Adds one read-only view and
-- one index on sms_grc_questions. No table, row, function or policy is
-- changed. The view runs with the permissions of whoever reads it
-- (security_invoker), so it shows nothing a reader could not already see;
-- the app reads it from the server only.
--
-- Run the whole file in the Supabase SQL editor (nothing selected, then
-- Run). Safe to run more than once.
--
-- Rollback:
--   DROP VIEW IF EXISTS sms_grc_topic_counts;
--   DROP INDEX IF EXISTS idx_sms_grc_questions_category_kind;
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_sms_grc_questions_category_kind
  ON sms_grc_questions (category_id, kind) WHERE archived_at IS NULL;

CREATE OR REPLACE VIEW sms_grc_topic_counts WITH (security_invoker = true) AS
  SELECT category_id, kind, count(*)::int AS questions
  FROM sms_grc_questions
  WHERE archived_at IS NULL
  GROUP BY category_id, kind;

REVOKE ALL ON sms_grc_topic_counts FROM PUBLIC, anon;
GRANT SELECT ON sms_grc_topic_counts TO authenticated, service_role;
