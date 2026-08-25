-- =====================================================
-- 054: GAME ROOM (real-time multiplayer classroom quiz platform)
--
-- Generic across every game type -- no game-specific columns anywhere.
-- game_type is a plain string validated at the API layer against
-- lib/gameRoom/registry.ts, not a DB CHECK, so adding a new game module
-- never requires a migration. question_ids/question_order are opaque
-- module-scoped string arrays (e.g. "tamil-grammar:tan_001") -- there is
-- no questions table; question banks live entirely in app code.
--
-- Anonymous participants: students join with a nickname only, no Clerk
-- account. sms_game_players.player_token is a bearer secret returned
-- once on join and required on every subsequent request -- a deliberate,
-- narrow divergence from this app's usual "RLS is the real boundary"
-- convention, since an anonymous browser has no Clerk JWT to present.
-- All player-facing routes (join/state/answer) use the service-role
-- admin client and enforce authorization in application code instead.
-- =====================================================

CREATE TABLE sms_game_sessions (
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

CREATE INDEX idx_sms_game_sessions_join_code ON sms_game_sessions(join_code);
CREATE INDEX idx_sms_game_sessions_host ON sms_game_sessions(host_teacher_id);

CREATE TABLE sms_game_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sms_game_sessions(id) ON DELETE CASCADE,
  player_token UUID NOT NULL DEFAULT uuid_generate_v4(),
  nickname TEXT NOT NULL,
  question_order TEXT[] NOT NULL,
  current_index INT NOT NULL DEFAULT 0,
  -- Server-authoritative timer anchor -- reset every time current_index
  -- advances (on join, and after each answer/timeout). response_time_ms
  -- is always computed as now() - this column, server-side, in
  -- app/api/game-room/answer/route.ts -- never trusts a client-supplied
  -- timestamp, since that would let a student fake a fast answer for a
  -- bigger speed bonus.
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

CREATE INDEX idx_sms_game_players_session ON sms_game_players(session_id);
CREATE INDEX idx_sms_game_players_token ON sms_game_players(player_token);

CREATE TABLE sms_game_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES sms_game_players(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  question_index INT NOT NULL,
  selected_answer TEXT,
  is_correct BOOLEAN NOT NULL,
  points INT NOT NULL,
  response_time_ms INT NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Hard DB-level guarantee against duplicate/replayed/skip-ahead answer
  -- submissions -- the API route also checks this before inserting, but
  -- this constraint is what makes it airtight under concurrent requests.
  UNIQUE(player_id, question_index)
);

CREATE INDEX idx_sms_game_answers_player ON sms_game_answers(player_id);

-- RLS: only the service-role client (bypasses RLS entirely) writes to
-- these tables. The SELECT policies below exist ONLY so a teacher's own
-- Clerk-authenticated browser client can read their own session's data
-- directly -- this powers the host dashboard's Supabase Realtime
-- subscription (postgres_changes requires a real SELECT policy to
-- deliver payloads to a subscriber).
ALTER TABLE sms_game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_game_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_sessions: host reads own" ON sms_game_sessions
  FOR SELECT USING (
    sms_current_role() = 'admin' OR
    host_teacher_id IN (SELECT id FROM sms_teachers WHERE profile_id = sms_current_user_id())
  );

CREATE POLICY "game_players: host reads own session's players" ON sms_game_players
  FOR SELECT USING (
    sms_current_role() = 'admin' OR
    session_id IN (
      SELECT id FROM sms_game_sessions WHERE host_teacher_id IN (
        SELECT id FROM sms_teachers WHERE profile_id = sms_current_user_id()
      )
    )
  );

-- No teacher-read policy on sms_game_answers -- the host dashboard's
-- aggregates (per-category accuracy, average response time) are
-- computed server-side via an admin-client API route, never read
-- directly by the browser, so no SELECT policy is needed here.

-- Resolves a join code to a session for an anonymous joiner -- same
-- SECURITY DEFINER narrow-lookup idiom as
-- sms_resolve_theni_season_by_join_code (050_tamil_theni_core.sql),
-- letting an unauthenticated caller resolve a code without needing any
-- RLS SELECT grant on sms_game_sessions itself.
CREATE OR REPLACE FUNCTION sms_resolve_game_session_by_join_code(p_code TEXT)
RETURNS TABLE (session_id UUID, status TEXT, game_type TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, status, game_type FROM sms_game_sessions WHERE join_code = p_code;
$$;

-- Shifts every incomplete player's timer anchor forward by the pause
-- duration on resume, so paused time never counts against a student's
-- remaining time on their in-flight question -- see
-- app/api/game-room/sessions/[id]/resume/route.ts. A raw SQL
-- column-to-column update; the Supabase JS client can't express
-- "current_question_started_at + N seconds" without a round trip.
CREATE OR REPLACE FUNCTION sms_shift_game_player_timers(p_session_id UUID, p_seconds INT)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE sms_game_players
  SET current_question_started_at = current_question_started_at + make_interval(secs => p_seconds)
  WHERE session_id = p_session_id AND completed = false;
$$;
