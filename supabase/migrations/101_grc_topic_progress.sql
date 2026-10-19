-- =====================================================
-- 101: GAMEROOM CLASSIC -- PLAY OFFLINE SCORES PER TOPIC
--
-- When a student finishes a Play Offline game (topics of the shared
-- question library, played on their own), their score is added up per
-- topic, so the student home can show a dashboard of how they are doing
-- in each topic they played. A game that combines topics counts each
-- question towards its own topic.
--
-- topic_key is the topic id, or none for questions without a topic.
-- Practice only: never a grade.
--
-- ISOLATION: touches only GameRoom Classic. Adds one new table. No other
-- table, function, policy or row is changed. Students never read or write
-- it directly: the server does (service role), for the signed-in student
-- only. RLS is on with an admin read policy only.
--
-- Run the whole file in the Supabase SQL editor (nothing selected, then
-- Run). Safe to run more than once.
--
-- Rollback: DROP TABLE IF EXISTS sms_grc_topic_progress;
-- =====================================================

CREATE TABLE IF NOT EXISTS sms_grc_topic_progress (
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  topic_key TEXT NOT NULL CHECK (topic_key = 'none' OR topic_key ~ '^[0-9a-f-]{36}$'),
  plays INT NOT NULL DEFAULT 0 CHECK (plays >= 0),
  answered INT NOT NULL DEFAULT 0 CHECK (answered >= 0),
  correct INT NOT NULL DEFAULT 0 CHECK (correct >= 0 AND correct <= answered),
  best_percent INT NOT NULL DEFAULT 0 CHECK (best_percent BETWEEN 0 AND 100),
  last_percent INT NOT NULL DEFAULT 0 CHECK (last_percent BETWEEN 0 AND 100),
  last_played_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, topic_key)
);

ALTER TABLE sms_grc_topic_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "grc_topic_progress: admin read" ON sms_grc_topic_progress;
CREATE POLICY "grc_topic_progress: admin read" ON sms_grc_topic_progress
  FOR SELECT USING (sms_current_role() = 'admin');
