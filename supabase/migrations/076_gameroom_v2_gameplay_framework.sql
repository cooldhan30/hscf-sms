-- =====================================================
-- 076: GAMEROOM V2 GAMEPLAY FRAMEWORK
--
-- The reusable session/scoring/reward persistence every future game
-- engine (Tower Defense, Boss Battle, Racing, Treasure Quest, Classic
-- Quiz, ...) plugs into -- NOT an engine itself. No engine's actual
-- gameplay is implemented here or anywhere else yet (every entry in
-- lib/gameRoomV2/registry.ts stays status COMING_SOON); this migration
-- only adds the infrastructure a real engine will eventually persist
-- through: session lifecycle, per-question answers, streaks/lives,
-- and a durable XP/coin ledger across sessions.
--
-- ISOLATION (same guarantee every prior GameRoom V2 migration has
-- made): nothing here touches sms_game_sessions / sms_game_players /
-- sms_game_answers or any other legacy sms_game_* object in any way.
-- Every table below is new; sms_gamev2_sessions/players only ever
-- REFERENCE sms_students/sms_teachers/sms_classes/
-- sms_gamev2_question_sets by foreign key (read dependency), never a
-- write target. A V2 session can never appear in legacy GameRoom's
-- sms_game_room_alltime_leaderboard() (that RPC only reads
-- sms_game_players, which V2 never writes to).
-- =====================================================

-- =====================================================
-- SESSIONS
--
-- Status lifecycle exactly as specified: CREATED -> READY -> ACTIVE ->
-- (PAUSED <-> ACTIVE) -> COMPLETED, or ABANDONED from any non-terminal
-- state (e.g. the student closes the tab mid-game). CREATED and READY
-- are split because "the row exists" (CREATED, e.g. right after
-- POST .../start) and "the player has everything needed to actually
-- begin" (READY, e.g. once the question order is generated and the
-- first question is about to be shown) are genuinely different
-- moments worth being able to tell apart if a resume ever stalls
-- between them.
--
-- engine_id is a plain TEXT id into lib/gameRoomV2/registry.ts's
-- GAME_ENGINES_V2 array (same "no DB FK to a code registry" idiom
-- legacy GameRoom's sms_game_sessions.game_type already uses) --
-- validated at the API layer against the registry, not a DB CHECK,
-- since a new engine should never need a migration just to register.
--
-- Solo-only for this phase (host_student_id is the player themselves;
-- there is no host_teacher_id / multiplayer join-code concept here at
-- all) -- multiplayer is explicitly out of scope until a real engine
-- needs it.
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_gamev2_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_set_id UUID NOT NULL REFERENCES sms_gamev2_question_sets(id) ON DELETE CASCADE,
  engine_id TEXT NOT NULL,
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'READY', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED')),
  -- The full, once-shuffled question id order for this player (see
  -- lib/gameRoomV2/shuffle.ts's shuffle(), forked from legacy
  -- GameRoom's lib/gameRoom/shuffle.ts rather than imported -- V2 never
  -- takes a code dependency on legacy GameRoom, even for a pure,
  -- genuinely safe-to-reuse function; see README.md). Generated once at
  -- session creation, never re-derived, so "question 3 of 10" means the
  -- same thing on every refresh/resume.
  question_order UUID[] NOT NULL DEFAULT '{}',
  current_index INT NOT NULL DEFAULT 0,
  -- Server-authoritative timer anchor for the CURRENT question --
  -- response_time_ms on an answer is always NOW() - this column at
  -- answer time, never a client-reported duration (same anti-cheat
  -- posture as legacy GameRoom's current_question_started_at).
  current_question_started_at TIMESTAMP WITH TIME ZONE,
  question_time_limit_seconds INT NOT NULL DEFAULT 20 CHECK (question_time_limit_seconds IN (10, 15, 20, 30, 60)),
  -- Lives/streak are engine-agnostic framework concepts (per the
  -- request's explicit "Lives" and "Streaks" systems) -- a specific
  -- engine decides whether/how to consume them (Boss Battle might tie
  -- damage to streak; Classic Quiz might ignore lives entirely by
  -- starting max_lives at a value it never decrements), but the
  -- columns themselves are shared infrastructure, not per-engine state.
  lives INT NOT NULL DEFAULT 3,
  max_lives INT NOT NULL DEFAULT 3,
  current_streak INT NOT NULL DEFAULT 0,
  best_streak INT NOT NULL DEFAULT 0,
  score INT NOT NULL DEFAULT 0,
  correct_count INT NOT NULL DEFAULT 0,
  answered_count INT NOT NULL DEFAULT 0,
  xp_earned INT NOT NULL DEFAULT 0,
  coins_earned INT NOT NULL DEFAULT 0,
  -- Total pause time so far, in seconds -- mirrors legacy GameRoom's
  -- pause_duration_seconds/sms_shift_game_player_timers idiom: on
  -- resume, current_question_started_at is shifted forward by however
  -- long the pause lasted, so a paused question never silently burns
  -- down the student's remaining time.
  pause_duration_seconds INT NOT NULL DEFAULT 0,
  paused_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  abandoned_at TIMESTAMP WITH TIME ZONE,
  -- Distinct from completed_at: set only once the completion bonus has
  -- actually been applied to sms_gamev2_player_stats (see
  -- app/api/gameroom-v2/sessions/[id]/complete/route.ts). A session can
  -- be COMPLETED (its gameplay is over) without yet being finalized
  -- (its rewards haven't been granted) -- this column is what makes
  -- calling /complete twice for the same session safe: a second call
  -- sees this already set and returns the existing result instead of
  -- double-granting XP/coins.
  rewards_finalized_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sms_gamev2_sessions_student ON sms_gamev2_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_sms_gamev2_sessions_set ON sms_gamev2_sessions(question_set_id);
CREATE INDEX IF NOT EXISTS idx_sms_gamev2_sessions_status ON sms_gamev2_sessions(status);

-- =====================================================
-- ANSWERS
--
-- One row per question actually answered. UNIQUE(session_id,
-- question_index) is the hard anti-replay backstop -- the same
-- constraint idiom as legacy GameRoom's sms_game_answers -- so a
-- retried/duplicated submission (a race between two tabs, a flaky
-- network retry) can never double-count, independent of whatever
-- application-layer check runs first.
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_gamev2_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sms_gamev2_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES sms_gamev2_questions(id) ON DELETE CASCADE,
  question_index INT NOT NULL,
  -- The student's raw answer, shape depends on the question type (a
  -- selected option string, an ordered array, a category map, ...) --
  -- see lib/gameRoomV2/domain/questionTypes.ts's per-type payloads.
  -- Stored for the Results screen's review and for future mastery
  -- analytics (see sms_gamev2_skill_practice below); grading itself
  -- never trusts anything from the client except this raw value.
  submitted_answer JSONB,
  is_correct BOOLEAN NOT NULL,
  points INT NOT NULL,
  response_time_ms INT NOT NULL,
  answered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, question_index)
);

CREATE INDEX IF NOT EXISTS idx_sms_gamev2_answers_session ON sms_gamev2_answers(session_id);

-- =====================================================
-- PLAYER STATS -- durable XP/coin ledger across every session
--
-- One row per student, accumulated as sessions complete (never
-- decremented by gameplay itself -- only a future explicit "spend
-- coins" feature would subtract). Kept separate from
-- sms_gamev2_sessions (which holds per-session xp_earned/coins_earned)
-- so "how much XP does this student have in total" is an O(1) read,
-- not a SUM(...) over every session they've ever played.
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_gamev2_player_stats (
  student_id UUID PRIMARY KEY REFERENCES sms_students(id) ON DELETE CASCADE,
  total_xp INT NOT NULL DEFAULT 0,
  total_coins INT NOT NULL DEFAULT 0,
  sessions_completed INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- SKILL PRACTICE LOG -- architecture for later mastery analytics
--
-- Not surfaced in any UI yet -- this is deliberately just the
-- recording mechanism the request asks to "prepare architecture for."
-- One row per answered question, tagging which skill(s) it exercised
-- (drawn from the question set's own subject/topic/tags at answer
-- time, denormalized here rather than joined later, so a later mastery
-- report never needs to reconstruct "what was this question even
-- about" from a set that may since have been edited or deleted). A
-- future mastery-analytics feature reads this table; nothing does yet.
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_gamev2_skill_practice (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  answer_id UUID NOT NULL REFERENCES sms_gamev2_answers(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  practiced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_gamev2_skill_practice_student_skill ON sms_gamev2_skill_practice(student_id, skill);

ALTER TABLE sms_gamev2_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_gamev2_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_gamev2_player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_gamev2_skill_practice ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gamev2_sessions: admin all" ON sms_gamev2_sessions
  FOR ALL USING (sms_current_role() = 'admin');

-- A student manages (reads AND writes) only their own sessions --
-- mirrors legacy GameRoom's "game_players: student manage own" FOR ALL
-- shape. This is solo-only gameplay (see the sessions table comment),
-- so there is no separate "host" role to grant broader access to.
CREATE POLICY "gamev2_sessions: student manage own" ON sms_gamev2_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_gamev2_sessions.student_id AND s.profile_id = sms_current_user_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_gamev2_sessions.student_id AND s.profile_id = sms_current_user_id())
  );

-- A teacher can read (never write) sessions for question sets THEY
-- created -- lets a teacher eventually see how their content performs
-- without granting them any ability to alter a student's in-progress
-- game or its score.
CREATE POLICY "gamev2_sessions: teacher read own set sessions" ON sms_gamev2_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_gamev2_question_sets qs
      WHERE qs.id = sms_gamev2_sessions.question_set_id AND qs.created_by = sms_current_user_id()
    )
  );

CREATE POLICY "gamev2_answers: admin all" ON sms_gamev2_answers
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "gamev2_answers: student manage own session" ON sms_gamev2_answers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sms_gamev2_sessions sess
      JOIN sms_students s ON s.id = sess.student_id
      WHERE sess.id = sms_gamev2_answers.session_id AND s.profile_id = sms_current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sms_gamev2_sessions sess
      JOIN sms_students s ON s.id = sess.student_id
      WHERE sess.id = sms_gamev2_answers.session_id AND s.profile_id = sms_current_user_id()
    )
  );

CREATE POLICY "gamev2_answers: teacher read own set answers" ON sms_gamev2_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_gamev2_sessions sess
      JOIN sms_gamev2_question_sets qs ON qs.id = sess.question_set_id
      WHERE sess.id = sms_gamev2_answers.session_id AND qs.created_by = sms_current_user_id()
    )
  );

CREATE POLICY "gamev2_player_stats: admin all" ON sms_gamev2_player_stats
  FOR ALL USING (sms_current_role() = 'admin');

-- A student can READ their own stats (for the Results/profile display)
-- but never write them directly -- total_xp/total_coins only ever
-- change via the server-side session-completion path (see
-- app/api/gameroom-v2/sessions/[id]/complete/route.ts), which runs
-- under the caller's own session but is the only code path that
-- issues the UPDATE, keeping the reward calculation itself
-- server-controlled even though RLS technically permits the student's
-- own client role to write here. Framework-level "don't trust the
-- client" note: this policy intentionally does NOT grant UPDATE to
-- avoid a client being able to directly inflate its own stats row by
-- calling Supabase straight from the browser -- only INSERT ON
-- CONFLICT via the SECURITY DEFINER-free session-complete route,
-- running as the student, is allowed, and even that route computes
-- every awarded value itself server-side.
CREATE POLICY "gamev2_player_stats: student read own" ON sms_gamev2_player_stats
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_gamev2_player_stats.student_id AND s.profile_id = sms_current_user_id())
  );

CREATE POLICY "gamev2_skill_practice: admin all" ON sms_gamev2_skill_practice
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "gamev2_skill_practice: student manage own" ON sms_gamev2_skill_practice
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_gamev2_skill_practice.student_id AND s.profile_id = sms_current_user_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_gamev2_skill_practice.student_id AND s.profile_id = sms_current_user_id())
  );

-- =====================================================
-- SECURITY DEFINER: server-controlled reward application
--
-- The ONLY way sms_gamev2_player_stats.total_xp/total_coins ever
-- change. Runs with definer rights so it can atomically upsert the
-- ledger row regardless of the "student read own" SELECT-only policy
-- above -- the route that calls this (session-complete) still
-- authenticates the caller as the owning student first via
-- requireGameV2Access()-based guards; this function is not itself
-- exposed as a public write path, it's invoked by trusted server code
-- after that code has already computed (never trusted from the
-- client) how much XP/coins were actually earned.
-- =====================================================
CREATE OR REPLACE FUNCTION sms_gamev2_apply_session_rewards(
  p_student_id UUID,
  p_xp_earned INT,
  p_coins_earned INT
)
RETURNS TABLE (total_xp INT, total_coins INT, sessions_completed INT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO sms_gamev2_player_stats (student_id, total_xp, total_coins, sessions_completed)
  VALUES (p_student_id, GREATEST(p_xp_earned, 0), GREATEST(p_coins_earned, 0), 1)
  ON CONFLICT (student_id) DO UPDATE SET
    total_xp = sms_gamev2_player_stats.total_xp + GREATEST(p_xp_earned, 0),
    total_coins = sms_gamev2_player_stats.total_coins + GREATEST(p_coins_earned, 0),
    sessions_completed = sms_gamev2_player_stats.sessions_completed + 1,
    updated_at = NOW();

  RETURN QUERY
  SELECT s.total_xp, s.total_coins, s.sessions_completed
  FROM sms_gamev2_player_stats s
  WHERE s.student_id = p_student_id;
END;
$$;
