-- =====================================================
-- 081: GAMEROOM V2 TAMIL RACING -- LIVE CLASSROOM MULTIPLAYER
--
-- Adds the one piece of configuration multiplayer racing genuinely
-- needs that didn't already exist: a configurable question count for
-- a live session, so a teacher hosting a race can choose "first 10
-- questions" for a quick sprint rather than always racing the full
-- Question Set. Nullable -- NULL (the default) means "use every
-- question in the set", preserving today's behavior for every
-- existing/future live session that never sets it.
--
-- Everything else multiplayer racing needs (one racer per participant,
-- synchronized progress, answer-correctness-advances-racer,
-- server-authoritative distance, reconnect recovery, late join,
-- finish ordering) is deliberately NOT a new table or column here --
-- it's derived read-only, server-side, from data that already exists
-- (sms_gamev2_live_participants + each participant's own
-- sms_gamev2_sessions + sms_gamev2_answers), replayed through the
-- exact same tested tickRace/applyAnswerEffect pure functions
-- lib/gameRoomV2/racing/race.ts already uses for solo play (see
-- replayRacerFromAnswers). No client ever reports its own racer
-- position, so there is nothing for a malicious client to spoof in
-- the first place -- this is the concrete mechanism behind "prevent
-- race progress manipulation" and "server-authoritative score/
-- progress where practical".
-- =====================================================

ALTER TABLE sms_gamev2_live_sessions
  ADD COLUMN IF NOT EXISTS question_count INT;

ALTER TABLE sms_gamev2_live_sessions
  ADD CONSTRAINT sms_gamev2_live_sessions_question_count_positive
  CHECK (question_count IS NULL OR question_count > 0);

COMMENT ON COLUMN sms_gamev2_live_sessions.question_count IS
  'Optional cap on how many questions this live session''s shared question_order includes, applied when the host starts the game (see app/api/gameroom-v2/live/[id]/start/route.ts). NULL means use every question in the linked Question Set -- the pre-existing default behavior.';

-- Racing specifically needs ONE shared difficulty for every racer in a
-- live session (base speed / boost / penalty / track length) -- unlike
-- solo play, where each student's own RaceSetupPicker choice only
-- affects their own private race, a live classroom race is only
-- meaningful as a shared comparison if every racer runs the identical
-- physics. Nullable/defaulted to 'normal' rather than NOT NULL so
-- every other engine's live session (which has no notion of
-- "difficulty" at the live-session level at all) is unaffected.
ALTER TABLE sms_gamev2_live_sessions
  ADD COLUMN IF NOT EXISTS race_difficulty TEXT NOT NULL DEFAULT 'normal'
  CHECK (race_difficulty IN ('easy', 'normal', 'hard'));

COMMENT ON COLUMN sms_gamev2_live_sessions.race_difficulty IS
  'Shared Racing difficulty (easy/normal/hard) for every participant in this live session -- set once at host time (see HostLiveModal.tsx), read by both the participant client (RacingGame.tsx, skipping its own solo RaceSetupPicker difficulty step) and the server-side replay in app/api/gameroom-v2/live/[id]/race/route.ts, so every racer''s physics are provably identical. Meaningless for any engine other than racing.';

-- =====================================================
-- SECURITY DEFINER (read-only): returns every participant's raw answer
-- history for a live session, so app/api/gameroom-v2/live/[id]/race/
-- route.ts can replay each racer's server-authoritative distance in
-- TypeScript via lib/gameRoomV2/racing/race.ts's
-- replayRacerFromAnswers -- the SAME tested pure function solo play's
-- own physics already runs on, never a second, SQL-reimplemented
-- physics engine that could drift from it.
--
-- Necessarily SECURITY DEFINER because a student watching a live race
-- needs to see every OTHER participant's progress too (not just their
-- own), and ordinary RLS on sms_gamev2_sessions/sms_gamev2_answers
-- ("student manage own") only ever grants a student their OWN rows --
-- by design, since solo play's own privacy model assumes no other
-- student should ever see another's answers. This function is the one
-- deliberate, narrow exception, and only for a live-classroom
-- multiplayer race specifically: it returns ONLY (session_id,
-- nickname, is_correct, answered_at, current_index, question_order
-- length, status) -- never the actual submitted_answer content, never
-- any other student's score/XP/coins, and nothing beyond what the
-- shared Track UI already displays about every OTHER racer today
-- (their position, not their answers).
--
-- Ownership check mirrors migration 080's precedent: the caller must
-- be either the live session's host teacher OR a participant who has
-- actually joined THIS specific live session -- never an arbitrary
-- authenticated caller passing an unrelated live_session_id, and never
-- cross-class (a student enrolled in a DIFFERENT class's live race
-- gets rejected even though they're a legitimate GameRoom V2 student
-- generally).
-- =====================================================
CREATE OR REPLACE FUNCTION sms_gamev2_get_live_race_state(p_live_session_id UUID)
RETURNS TABLE (
  participant_id UUID,
  nickname TEXT,
  session_id UUID,
  session_status TEXT,
  question_order_length INT,
  current_index INT,
  is_correct BOOLEAN,
  answered_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_live sms_gamev2_live_sessions%ROWTYPE;
  v_is_host BOOLEAN;
  v_is_participant BOOLEAN;
BEGIN
  SELECT * INTO v_live FROM sms_gamev2_live_sessions WHERE id = p_live_session_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM sms_teachers t WHERE t.id = v_live.host_teacher_id AND t.profile_id = sms_current_user_id()
  ) INTO v_is_host;

  SELECT EXISTS (
    SELECT 1 FROM sms_gamev2_live_participants p
    JOIN sms_students s ON s.id = p.student_id
    WHERE p.live_session_id = p_live_session_id AND s.profile_id = sms_current_user_id()
  ) INTO v_is_participant;

  IF NOT v_is_host AND NOT v_is_participant THEN
    RAISE EXCEPTION 'You are not part of this live session';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.nickname,
    sess.id,
    sess.status,
    array_length(sess.question_order, 1),
    sess.current_index,
    a.is_correct,
    a.answered_at
  FROM sms_gamev2_live_participants p
  LEFT JOIN sms_gamev2_sessions sess ON sess.id = p.session_id
  LEFT JOIN sms_gamev2_answers a ON a.session_id = sess.id
  WHERE p.live_session_id = p_live_session_id
  ORDER BY p.joined_at ASC, a.question_index ASC;
END;
$$;

REVOKE ALL ON FUNCTION sms_gamev2_get_live_race_state(UUID) FROM anon;
