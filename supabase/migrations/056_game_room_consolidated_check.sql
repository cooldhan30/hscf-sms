-- =====================================================
-- 056: GAME ROOM -- consolidated, idempotent re-apply
--
-- Combines 054_game_room.sql (tables/RLS/RPCs/Realtime publication) and
-- 055_game_room_host_write_policies.sql (host INSERT/UPDATE fix) into
-- one script safe to run regardless of which of those already applied
-- cleanly. Every statement guards against already existing, so running
-- this on a database that's already fully up to date is a no-op.
-- =====================================================

CREATE TABLE IF NOT EXISTS sms_game_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  join_code TEXT UNIQUE NOT NULL DEFAULT sms_generate_join_code(),
  host_teacher_id UUID NOT NULL REFERENCES sms_teachers(id),
  game_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'paused', 'ended')),
  quiz_mode TEXT NOT NULL,
  category_filter TEXT,
  question_count INT NOT NULL,
  question_time_limit_seconds INT NOT NULL DEFAULT 20 CHECK (question_time_limit_seconds IN (10, 15, 20, 30)),
  question_ids TEXT[] NOT NULL,
  paused_at TIMESTAMPTZ,
  pause_duration_seconds INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sms_game_sessions_join_code ON sms_game_sessions(join_code);
CREATE INDEX IF NOT EXISTS idx_sms_game_sessions_host ON sms_game_sessions(host_teacher_id);

CREATE TABLE IF NOT EXISTS sms_game_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sms_game_sessions(id) ON DELETE CASCADE,
  player_token UUID NOT NULL DEFAULT uuid_generate_v4(),
  nickname TEXT NOT NULL,
  question_order TEXT[] NOT NULL,
  current_index INT NOT NULL DEFAULT 0,
  current_question_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  score INT NOT NULL DEFAULT 0,
  correct_count INT NOT NULL DEFAULT 0,
  answered_count INT NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  connected BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(session_id, player_token)
);

CREATE INDEX IF NOT EXISTS idx_sms_game_players_session ON sms_game_players(session_id);
CREATE INDEX IF NOT EXISTS idx_sms_game_players_token ON sms_game_players(player_token);

CREATE TABLE IF NOT EXISTS sms_game_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES sms_game_players(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  question_index INT NOT NULL,
  selected_answer TEXT,
  is_correct BOOLEAN NOT NULL,
  points INT NOT NULL,
  response_time_ms INT NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, question_index)
);

CREATE INDEX IF NOT EXISTS idx_sms_game_answers_player ON sms_game_answers(player_id);

ALTER TABLE sms_game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_game_answers ENABLE ROW LEVEL SECURITY;

-- Drop both possible prior names before recreating, so this is safe to
-- run whether 054 (SELECT-only, "host reads own") or 055 (FOR ALL,
-- "host manages own") -- or neither -- already ran.
DROP POLICY IF EXISTS "game_sessions: host reads own" ON sms_game_sessions;
DROP POLICY IF EXISTS "game_sessions: host manages own" ON sms_game_sessions;
CREATE POLICY "game_sessions: host manages own" ON sms_game_sessions
  FOR ALL USING (
    sms_current_role() = 'admin' OR
    host_teacher_id IN (SELECT id FROM sms_teachers WHERE profile_id = sms_current_user_id())
  )
  WITH CHECK (
    sms_current_role() = 'admin' OR
    host_teacher_id IN (SELECT id FROM sms_teachers WHERE profile_id = sms_current_user_id())
  );

DROP POLICY IF EXISTS "game_players: host reads own session's players" ON sms_game_players;
CREATE POLICY "game_players: host reads own session's players" ON sms_game_players
  FOR SELECT USING (
    sms_current_role() = 'admin' OR
    session_id IN (
      SELECT id FROM sms_game_sessions WHERE host_teacher_id IN (
        SELECT id FROM sms_teachers WHERE profile_id = sms_current_user_id()
      )
    )
  );

CREATE OR REPLACE FUNCTION sms_resolve_game_session_by_join_code(p_code TEXT)
RETURNS TABLE (session_id UUID, status TEXT, game_type TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, status, game_type FROM sms_game_sessions WHERE join_code = p_code;
$$;

CREATE OR REPLACE FUNCTION sms_shift_game_player_timers(p_session_id UUID, p_seconds INT)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE sms_game_players
  SET current_question_started_at = current_question_started_at + make_interval(secs => p_seconds)
  WHERE session_id = p_session_id AND completed = false;
$$;

-- This is the block most likely to have been silently skipped if 054
-- was ever run in a truncated paste -- confirmed to matter: without it,
-- the teacher dashboard's Realtime subscription joins successfully but
-- never receives a single event, since RLS SELECT policies alone don't
-- register a table for postgres_changes delivery.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sms_game_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sms_game_sessions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sms_game_players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sms_game_players;
  END IF;
END $$;

-- Diagnostic: run this SELECT after the block above to directly confirm
-- both tables are registered for Realtime delivery -- should return
-- exactly 2 rows.
SELECT schemaname, tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename IN ('sms_game_sessions', 'sms_game_players');
