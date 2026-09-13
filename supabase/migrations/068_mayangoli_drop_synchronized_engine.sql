-- =====================================================
-- 068: MAYANGOLI -- drop the synchronized-session engine
--
-- Mayangoli was rebuilt as a classic GameModule plugged into the
-- EXISTING self-paced Game Room engine (sms_game_sessions/players/
-- answers, lib/gameRoom/modules/mayangoli/index.ts), per explicit
-- product decision: students answer independently and move on
-- immediately with instant per-question feedback, rather than a
-- room-wide pace gated on the teacher clicking Reveal/Next.
--
-- Everything created by 065/066/067 for the standalone synchronized
-- session model is now dead and is dropped here: the three
-- sms_mayangoli_* tables, their RPCs, the word-override table, and the
-- two RLS-recursion-fix helper functions. sms_game_sessions/players/
-- answers (the engine Mayangoli now actually uses) are untouched.
-- =====================================================

DROP FUNCTION IF EXISTS sms_is_mayangoli_session_host(UUID);
DROP FUNCTION IF EXISTS sms_is_mayangoli_session_player(UUID);
DROP FUNCTION IF EXISTS sms_resolve_mayangoli_session_by_join_code(TEXT);
DROP FUNCTION IF EXISTS sms_mayangoli_leaderboard(UUID);
DROP FUNCTION IF EXISTS sms_mayangoli_question_summary(UUID, INT);
DROP FUNCTION IF EXISTS sms_mayangoli_letter_accuracy(UUID);

DROP TABLE IF EXISTS sms_mayangoli_answers;
DROP TABLE IF EXISTS sms_mayangoli_players;
DROP TABLE IF EXISTS sms_mayangoli_sessions;
DROP TABLE IF EXISTS sms_mayangoli_word_overrides;

-- Realtime publication membership is dropped automatically along with
-- the tables themselves -- no separate ALTER PUBLICATION ... DROP
-- TABLE needed.
