-- =====================================================
-- 065: MAYANGOLI -- synchronized (Kahoot-style) live session engine
--
-- The existing Game Room engine (sms_game_sessions/sms_game_players,
-- 054_game_room.sql onward) is SELF-PACED: each player has their own
-- current_index and moves through their own question_order at their
-- own speed. Mayangoli Challenge needs a genuinely different model --
-- one current question for the WHOLE ROOM at a time, advanced by the
-- teacher (or an auto-advance timer), with every student answering the
-- same question simultaneously before a group reveal. Bolting that
-- onto sms_game_sessions would mean either breaking its self-paced
-- contract for every existing game, or overloading current_index with
-- two incompatible meanings -- so this is a new, parallel schema
-- instead, reusing every other idiom from the existing engine
-- (join-code resolution, Clerk-authenticated student identity, RLS-as-
-- the-real-boundary, SECURITY DEFINER cross-player reads, Realtime
-- publication membership).
--
-- sms_game_sessions itself is untouched by this migration.
-- =====================================================

CREATE TABLE sms_mayangoli_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  join_code TEXT UNIQUE NOT NULL DEFAULT sms_generate_join_code(),
  host_teacher_id UUID NOT NULL REFERENCES sms_teachers(id),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'reveal', 'ended')),
  -- The room-wide question set and per-question config, decided once
  -- at session creation (teacher setup screen) -- mirrors
  -- sms_game_sessions.question_ids, but every player in THIS session
  -- sees the identical question at the identical index, not their own
  -- shuffled order.
  question_ids TEXT[] NOT NULL,
  question_time_limit_seconds INT NOT NULL DEFAULT 20,
  -- 0-based index into question_ids of the question currently live (or
  -- most recently revealed, once status = 'reveal'). -1 while
  -- 'waiting' (no question started yet).
  current_question_index INT NOT NULL DEFAULT -1,
  -- Server-authoritative timer anchor for the CURRENT question, reset
  -- every time current_question_index advances -- the same
  -- "response_time_ms is always now() - this column" anti-cheat
  -- pattern as sms_game_players.current_question_started_at, just at
  -- the room level instead of per-player.
  current_question_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

CREATE INDEX idx_sms_mayangoli_sessions_join_code ON sms_mayangoli_sessions(join_code);
CREATE INDEX idx_sms_mayangoli_sessions_host ON sms_mayangoli_sessions(host_teacher_id);

CREATE TABLE sms_mayangoli_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sms_mayangoli_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  correct_count INT NOT NULL DEFAULT 0,
  answered_count INT NOT NULL DEFAULT 0,
  -- Current consecutive-correct streak -- resets to 0 on any wrong/
  -- timed-out answer, drives the streak bonus (calculateMayangoliPoints)
  -- and the 🔥/🔥🔥/🏆 badges shown on the leaderboard.
  current_streak INT NOT NULL DEFAULT 0,
  best_streak INT NOT NULL DEFAULT 0,
  connected BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

CREATE INDEX idx_sms_mayangoli_players_session ON sms_mayangoli_players(session_id);

CREATE TABLE sms_mayangoli_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES sms_mayangoli_players(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sms_mayangoli_sessions(id) ON DELETE CASCADE,
  question_index INT NOT NULL,
  -- The word bank id + generated question type this answer was for --
  -- needed by the "category struggle" report (accuracy by target
  -- letter) since the same word can generate different question types
  -- across different games.
  word_id TEXT NOT NULL,
  question_type TEXT NOT NULL,
  target_letter TEXT NOT NULL,
  selected_answer TEXT,
  is_correct BOOLEAN NOT NULL,
  points INT NOT NULL,
  response_time_ms INT NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Same hard anti-replay/anti-skip guarantee as
  -- sms_game_answers.UNIQUE(player_id, question_index).
  UNIQUE(player_id, question_index)
);

CREATE INDEX idx_sms_mayangoli_answers_player ON sms_mayangoli_answers(player_id);
CREATE INDEX idx_sms_mayangoli_answers_session ON sms_mayangoli_answers(session_id);

ALTER TABLE sms_mayangoli_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_mayangoli_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_mayangoli_answers ENABLE ROW LEVEL SECURITY;

-- Teacher manages (create/start/advance/end) their own sessions --
-- FOR ALL in one policy, same shape as "game_sessions: host manages
-- own" (055_game_room_host_write_policies.sql).
CREATE POLICY "mayangoli_sessions: host manages own" ON sms_mayangoli_sessions
  FOR ALL USING (
    sms_current_role() = 'admin' OR
    host_teacher_id IN (SELECT id FROM sms_teachers WHERE profile_id = sms_current_user_id())
  )
  WITH CHECK (
    sms_current_role() = 'admin' OR
    host_teacher_id IN (SELECT id FROM sms_teachers WHERE profile_id = sms_current_user_id())
  );

-- Student reads/joins their own session's row -- students never see
-- another student's row directly (the leaderboard/reveal screen reads
-- through the SECURITY DEFINER RPC below instead).
CREATE POLICY "mayangoli_sessions: player reads own session" ON sms_mayangoli_sessions
  FOR SELECT USING (
    id IN (
      SELECT session_id FROM sms_mayangoli_players p
      JOIN sms_students s ON s.id = p.student_id
      WHERE s.profile_id = sms_current_user_id()
    )
  );

CREATE POLICY "mayangoli_players: host reads own session's players" ON sms_mayangoli_players
  FOR SELECT USING (
    sms_current_role() = 'admin' OR
    session_id IN (
      SELECT id FROM sms_mayangoli_sessions WHERE host_teacher_id IN (
        SELECT id FROM sms_teachers WHERE profile_id = sms_current_user_id()
      )
    )
  );

CREATE POLICY "mayangoli_players: student manages own" ON sms_mayangoli_players
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_mayangoli_players.student_id AND s.profile_id = sms_current_user_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_mayangoli_players.student_id AND s.profile_id = sms_current_user_id())
  );

CREATE POLICY "mayangoli_answers: student manages own" ON sms_mayangoli_answers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sms_mayangoli_players p JOIN sms_students s ON s.id = p.student_id
      WHERE p.id = sms_mayangoli_answers.player_id AND s.profile_id = sms_current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sms_mayangoli_players p JOIN sms_students s ON s.id = p.student_id
      WHERE p.id = sms_mayangoli_answers.player_id AND s.profile_id = sms_current_user_id()
    )
  );

-- Resolves a join code for a student joining the lobby -- same narrow
-- SECURITY DEFINER lookup idiom as
-- sms_resolve_game_session_by_join_code.
CREATE OR REPLACE FUNCTION sms_resolve_mayangoli_session_by_join_code(p_code TEXT)
RETURNS TABLE (session_id UUID, status TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, status FROM sms_mayangoli_sessions WHERE join_code = p_code;
$$;

-- Room-wide leaderboard, ordered by score -- same "bypass RLS for one
-- safe, scoped read" idiom as sms_game_session_leaderboard, needed
-- because a student's own RLS policy only exposes their own player row.
CREATE OR REPLACE FUNCTION sms_mayangoli_leaderboard(p_session_id UUID)
RETURNS TABLE (
  id UUID, nickname TEXT, score INT, correct_count INT, answered_count INT,
  current_streak INT, best_streak INT, connected BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, nickname, score, correct_count, answered_count, current_streak, best_streak, connected
  FROM sms_mayangoli_players
  WHERE session_id = p_session_id
  ORDER BY score DESC;
$$;

-- Per-question answer summary (accuracy, fastest response) for the
-- reveal screen ("82% answered correctly") -- computed via RPC rather
-- than a direct student read, since sms_mayangoli_answers has no
-- student-facing SELECT policy at all (matches sms_game_answers'
-- "no teacher-read policy, aggregates go through admin-side reads"
-- precedent, generalized here to also cover the student reveal view).
CREATE OR REPLACE FUNCTION sms_mayangoli_question_summary(p_session_id UUID, p_question_index INT)
RETURNS TABLE (total_answers BIGINT, correct_answers BIGINT, fastest_response_ms INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COUNT(*)::BIGINT AS total_answers,
    COUNT(*) FILTER (WHERE is_correct)::BIGINT AS correct_answers,
    MIN(response_time_ms) FILTER (WHERE is_correct) AS fastest_response_ms
  FROM sms_mayangoli_answers
  WHERE session_id = p_session_id AND question_index = p_question_index;
$$;

-- Category/letter accuracy report for the teacher's post-game screen
-- ("ழ் 62% Needs Practice") -- aggregates every answer in this session
-- by target_letter.
CREATE OR REPLACE FUNCTION sms_mayangoli_letter_accuracy(p_session_id UUID)
RETURNS TABLE (target_letter TEXT, total BIGINT, correct BIGINT, accuracy_pct INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    target_letter,
    COUNT(*)::BIGINT AS total,
    COUNT(*) FILTER (WHERE is_correct)::BIGINT AS correct,
    ROUND(100.0 * COUNT(*) FILTER (WHERE is_correct) / NULLIF(COUNT(*), 0))::INT AS accuracy_pct
  FROM sms_mayangoli_answers
  WHERE session_id = p_session_id
  GROUP BY target_letter
  ORDER BY accuracy_pct ASC NULLS LAST;
$$;

-- Realtime: both the host dashboard AND the student play screen need
-- live updates for Mayangoli (unlike the existing engine, where only
-- the host uses Realtime and students poll) -- the whole point of a
-- synchronized game is that every client reacts the instant the room
-- advances to the next question, which a 2s poll would make feel
-- laggy/unfair when speed bonuses are at stake. Idempotent -- safe to
-- rerun.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sms_mayangoli_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sms_mayangoli_sessions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sms_mayangoli_players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sms_mayangoli_players;
  END IF;
END $$;
