-- =====================================================
-- 064: TAMIL WORD FORMATION -- per-student level unlock
-- progress
--
-- This game's shape doesn't fit sms_game_sessions/sms_game_players
-- alone: it has a persistent notion of "which levels has this student
-- unlocked" that must survive across many separate play sessions
-- (unlike every other interactive game, which is a single self-
-- contained round with no state carried between plays). One row per
-- (student, complexity) tracks the highest level unlocked in that
-- complexity tier -- level 1 of each of the three complexities starts
-- unlocked by default (a fresh row is created with highest_unlocked = 1
-- the first time a student touches that complexity).
--
-- Completing a level still writes a normal sms_game_players/
-- sms_game_sessions row too (one per completed level, is_solo_practice
-- = false so it counts toward the leaderboard, matching every other
-- interactive game) -- this table exists ONLY for unlock-gating, not
-- as a duplicate of score history.
-- =====================================================

CREATE TABLE IF NOT EXISTS sms_word_formation_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  complexity TEXT NOT NULL CHECK (complexity IN ('easy', 'medium', 'hard')),
  highest_unlocked INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, complexity)
);

CREATE INDEX IF NOT EXISTS idx_sms_word_formation_progress_student ON sms_word_formation_progress(student_id);

ALTER TABLE sms_word_formation_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "word_formation_progress: student manages own" ON sms_word_formation_progress;
CREATE POLICY "word_formation_progress: student manages own" ON sms_word_formation_progress
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_word_formation_progress.student_id AND s.profile_id = sms_current_user_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_word_formation_progress.student_id AND s.profile_id = sms_current_user_id())
  );
