-- =====================================================
-- 105: GAMEROOM CLASSIC -- LIVE GAMES FLOW ON THEIR OWN
--
-- Once the teacher presses Start, the server moves a live Classic Quiz
-- on by itself (time up -> answer -> leaderboard -> next question). The
-- teacher can Pause that from the projector screen; this column remembers
-- the choice so every poll (teacher's or students') respects it.
--
-- ISOLATION: purely additive. One new column with a default on the 096
-- sms_grc_live_sessions table; the existing "teacher manage own" policy
-- already covers updating it. Until this runs, auto-play is simply always
-- on (the app reads the column only when present).
--
-- Run the whole file in the Supabase SQL editor. Safe to run more than once.
--
-- Rollback: ALTER TABLE sms_grc_live_sessions DROP COLUMN auto_play;
-- =====================================================

ALTER TABLE sms_grc_live_sessions ADD COLUMN IF NOT EXISTS auto_play BOOLEAN NOT NULL DEFAULT true;
