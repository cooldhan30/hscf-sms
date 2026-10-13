-- =====================================================
-- 096: GAMEROOM CLASSIC -- LIVE CLASSROOM (Phase 5)
--
-- A teacher hosts one of their saved games live for one of their classes.
-- Signed-in students from that class join with a 6-digit PIN (or QR
-- code) and play together. The server runs the clock and the scores.
--
-- ISOLATION: purely additive. Creates only new sms_grc_* tables and one
-- new sms_grc_* function. No existing table, column, function, policy or
-- row is changed. It references sms_profiles, sms_classes, sms_students
-- and the 094 sms_grc_games table, and reuses the existing helpers
-- sms_current_role(), sms_current_user_id(), sms_teacher_owns_class()
-- and sms_update_updated_at_column().
--
-- WHO CAN DO WHAT
--   Teachers: host live games for classes they teach, control them, and
--     read who joined and how they answered. They cannot write answers.
--   Students: no direct table access. They join and answer through server
--     routes that check their class enrollment and never send answer keys.
--   Admins: read everything.
--
-- Run the whole file in the Supabase SQL editor (nothing selected, then
-- Run). Safe to run more than once.
--
-- Rollback (nothing else depends on these tables):
--   DROP TABLE sms_grc_live_answers, sms_grc_live_players, sms_grc_live_content, sms_grc_live_sessions;
--   DROP FUNCTION sms_grc_create_live_session(UUID, UUID, TEXT, TEXT, TEXT, INT, JSONB, JSONB, INT);
-- =====================================================

-- One live game. status moves lobby -> question -> reveal -> leaderboard
-- -> question ... -> ended (Classic Quiz), or lobby -> race -> ended
-- (Match the Pairs and Word Builder: everyone plays at their own pace).
CREATE TABLE IF NOT EXISTS sms_grc_live_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id TEXT NOT NULL REFERENCES sms_profiles(id) ON DELETE CASCADE,
  game_id UUID REFERENCES sms_grc_games(id) ON DELETE SET NULL,
  class_id UUID NOT NULL REFERENCES sms_classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  game_type TEXT NOT NULL CHECK (game_type IN ('quiz', 'match', 'word-builder')),
  pin TEXT NOT NULL CHECK (pin ~ '^[0-9]{6}$'),
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'question', 'reveal', 'leaderboard', 'race', 'ended')),
  current_index INT NOT NULL DEFAULT -1,
  question_started_at TIMESTAMP WITH TIME ZONE,
  question_ends_at TIMESTAMP WITH TIME ZONE,
  live_seconds INT NOT NULL CHECK (live_seconds IN (10, 20, 30, 60)),
  question_count INT NOT NULL CHECK (question_count BETWEEN 1 AND 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);
-- A PIN is unique among games that have not ended.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sms_grc_live_sessions_pin ON sms_grc_live_sessions(pin) WHERE status <> 'ended';
CREATE INDEX IF NOT EXISTS idx_sms_grc_live_sessions_owner ON sms_grc_live_sessions(owner_id, created_at);

-- The frozen questions (with answer keys) and the answer-free version in
-- play order. Only the hosting teacher (and the server) can read this.
CREATE TABLE IF NOT EXISTS sms_grc_live_content (
  session_id UUID PRIMARY KEY REFERENCES sms_grc_live_sessions(id) ON DELETE CASCADE,
  questions JSONB NOT NULL CHECK (jsonb_typeof(questions) = 'array'),
  play JSONB NOT NULL CHECK (jsonb_typeof(play) = 'array')
);

CREATE TABLE IF NOT EXISTS sms_grc_live_players (
  session_id UUID NOT NULL REFERENCES sms_grc_live_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL,
  nickname TEXT NOT NULL CHECK (char_length(nickname) BETWEEN 1 AND 40),
  finished_at TIMESTAMP WITH TIME ZONE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, student_id),
  UNIQUE (session_id, profile_id)
);

-- One answer per player per question (the first one counts). Points are
-- for fun only and never become a grade.
CREATE TABLE IF NOT EXISTS sms_grc_live_answers (
  session_id UUID NOT NULL,
  student_id UUID NOT NULL,
  question_id UUID NOT NULL,
  response JSONB NOT NULL,
  correct_units INT NOT NULL CHECK (correct_units >= 0),
  total_units INT NOT NULL CHECK (total_units >= 1),
  points INT NOT NULL DEFAULT 0 CHECK (points >= 0),
  done BOOLEAN NOT NULL DEFAULT true,
  answered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, student_id, question_id),
  FOREIGN KEY (session_id, student_id) REFERENCES sms_grc_live_players(session_id, student_id) ON DELETE CASCADE
);

DROP TRIGGER IF EXISTS trg_sms_grc_live_sessions_updated_at ON sms_grc_live_sessions;
CREATE TRIGGER trg_sms_grc_live_sessions_updated_at BEFORE UPDATE ON sms_grc_live_sessions
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();

-- Create a live game and its frozen questions in one step. SECURITY
-- INVOKER, so RLS decides: the caller must teach the class.
CREATE OR REPLACE FUNCTION sms_grc_create_live_session(
  p_game_id UUID,
  p_class_id UUID,
  p_title TEXT,
  p_game_type TEXT,
  p_pin TEXT,
  p_live_seconds INT,
  p_questions JSONB,
  p_play JSONB,
  p_question_count INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_id UUID;
BEGIN
  IF NOT sms_teacher_owns_class(p_class_id) THEN
    RAISE EXCEPTION 'GameRoom Classic: you can only host live games for your own classes';
  END IF;
  INSERT INTO sms_grc_live_sessions (owner_id, game_id, class_id, title, game_type, pin, live_seconds, question_count)
  VALUES (sms_current_user_id(), p_game_id, p_class_id, btrim(p_title), p_game_type, p_pin, p_live_seconds, p_question_count)
  RETURNING id INTO v_id;
  INSERT INTO sms_grc_live_content (session_id, questions, play) VALUES (v_id, p_questions, p_play);
  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION sms_grc_create_live_session(UUID, UUID, TEXT, TEXT, TEXT, INT, JSONB, JSONB, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sms_grc_create_live_session(UUID, UUID, TEXT, TEXT, TEXT, INT, JSONB, JSONB, INT) TO authenticated;

-- ---------- Row Level Security ----------
ALTER TABLE sms_grc_live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_grc_live_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_grc_live_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_grc_live_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "grc_live_sessions: teacher manage own" ON sms_grc_live_sessions;
CREATE POLICY "grc_live_sessions: teacher manage own" ON sms_grc_live_sessions
  FOR ALL USING (sms_current_role() = 'teacher' AND owner_id = sms_current_user_id())
  WITH CHECK (sms_current_role() = 'teacher' AND owner_id = sms_current_user_id() AND sms_teacher_owns_class(class_id));
DROP POLICY IF EXISTS "grc_live_sessions: admin read" ON sms_grc_live_sessions;
CREATE POLICY "grc_live_sessions: admin read" ON sms_grc_live_sessions
  FOR SELECT USING (sms_current_role() = 'admin');

DROP POLICY IF EXISTS "grc_live_content: teacher manage own" ON sms_grc_live_content;
CREATE POLICY "grc_live_content: teacher manage own" ON sms_grc_live_content
  FOR ALL USING (
    sms_current_role() = 'teacher'
    AND EXISTS (SELECT 1 FROM sms_grc_live_sessions s WHERE s.id = sms_grc_live_content.session_id AND s.owner_id = sms_current_user_id())
  )
  WITH CHECK (
    sms_current_role() = 'teacher'
    AND EXISTS (SELECT 1 FROM sms_grc_live_sessions s WHERE s.id = sms_grc_live_content.session_id AND s.owner_id = sms_current_user_id())
  );
DROP POLICY IF EXISTS "grc_live_content: admin read" ON sms_grc_live_content;
CREATE POLICY "grc_live_content: admin read" ON sms_grc_live_content
  FOR SELECT USING (sms_current_role() = 'admin');

-- Players and answers: hosting teachers READ; only the server writes.
DROP POLICY IF EXISTS "grc_live_players: teacher read own sessions" ON sms_grc_live_players;
CREATE POLICY "grc_live_players: teacher read own sessions" ON sms_grc_live_players
  FOR SELECT USING (
    sms_current_role() = 'teacher'
    AND EXISTS (SELECT 1 FROM sms_grc_live_sessions s WHERE s.id = sms_grc_live_players.session_id AND s.owner_id = sms_current_user_id())
  );
DROP POLICY IF EXISTS "grc_live_players: admin read" ON sms_grc_live_players;
CREATE POLICY "grc_live_players: admin read" ON sms_grc_live_players
  FOR SELECT USING (sms_current_role() = 'admin');

DROP POLICY IF EXISTS "grc_live_answers: teacher read own sessions" ON sms_grc_live_answers;
CREATE POLICY "grc_live_answers: teacher read own sessions" ON sms_grc_live_answers
  FOR SELECT USING (
    sms_current_role() = 'teacher'
    AND EXISTS (SELECT 1 FROM sms_grc_live_sessions s WHERE s.id = sms_grc_live_answers.session_id AND s.owner_id = sms_current_user_id())
  );
DROP POLICY IF EXISTS "grc_live_answers: admin read" ON sms_grc_live_answers;
CREATE POLICY "grc_live_answers: admin read" ON sms_grc_live_answers
  FOR SELECT USING (sms_current_role() = 'admin');
