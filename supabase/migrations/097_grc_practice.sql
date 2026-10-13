-- =====================================================
-- 097: GAMEROOM CLASSIC -- SELF-PRACTICE (Phase 6)
--
-- Students practise games made by their teachers, on their own, any time.
--
-- ISOLATION: touches only GameRoom Classic. Adds one column to the 094
-- sms_grc_games table (a practice on/off switch, on by default) and one
-- new table for the practice progress of each student. No other table,
-- function, policy or row is changed.
--
-- WHO CAN DO WHAT
--   Teachers: switch practice on or off for their own games (their
--     existing "manage own" policy on sms_grc_games covers the column),
--     and read practice progress on their own games.
--   Students: no direct table access. They practise through server routes
--     that only offer games from teachers of classes they are enrolled in,
--     and never send answer keys.
--   Admins: read everything.
--
-- Run the whole file in the Supabase SQL editor (nothing selected, then
-- Run). Safe to run more than once.
--
-- Rollback:
--   DROP TABLE sms_grc_practice_progress;
--   ALTER TABLE sms_grc_games DROP COLUMN practice;
-- =====================================================

ALTER TABLE sms_grc_games ADD COLUMN IF NOT EXISTS practice BOOLEAN NOT NULL DEFAULT true;

-- Practice scores are for encouragement only; they are never grades.
CREATE TABLE IF NOT EXISTS sms_grc_practice_progress (
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES sms_grc_games(id) ON DELETE CASCADE,
  plays INT NOT NULL DEFAULT 0 CHECK (plays >= 0),
  best_percent INT NOT NULL DEFAULT 0 CHECK (best_percent BETWEEN 0 AND 100),
  last_percent INT NOT NULL DEFAULT 0 CHECK (last_percent BETWEEN 0 AND 100),
  last_played_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, game_id)
);
CREATE INDEX IF NOT EXISTS idx_sms_grc_practice_progress_game ON sms_grc_practice_progress(game_id);

ALTER TABLE sms_grc_practice_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "grc_practice_progress: teacher read own games" ON sms_grc_practice_progress;
CREATE POLICY "grc_practice_progress: teacher read own games" ON sms_grc_practice_progress
  FOR SELECT USING (
    sms_current_role() = 'teacher'
    AND EXISTS (SELECT 1 FROM sms_grc_games g WHERE g.id = sms_grc_practice_progress.game_id AND g.owner_id = sms_current_user_id())
  );
DROP POLICY IF EXISTS "grc_practice_progress: admin read" ON sms_grc_practice_progress;
CREATE POLICY "grc_practice_progress: admin read" ON sms_grc_practice_progress
  FOR SELECT USING (sms_current_role() = 'admin');
