-- =====================================================
-- 079: GAMEROOM V2 LIVE CLASSROOM
--
-- The FIRST genuinely multiplayer/real-time infrastructure in GameRoom
-- V2 -- everything before this (6 solo engines, progression, learning
-- analytics) is single-student, poll-based. Per the explicit request
-- ("first implement and test the infrastructure using a simple game
-- mode... do not immediately retrofit every game"), this migration
-- only builds the SHARED lobby/session/presence layer; only
-- classic-quiz (the thin reference engine) is wired to it this pass.
-- Racing and Boss Battle -- which already declare
-- compatibility.liveClassroomSupport: true in the registry, a promise
-- made ahead of this infrastructure existing -- are integrated in a
-- LATER pass once this is proven stable, not here.
--
-- ARCHITECTURE: sms_gamev2_sessions.student_id is UUID NOT NULL
-- (singular) -- structurally incapable of representing "N students in
-- one live session". Mirrors legacy GameRoom's own proven split
-- (sms_game_sessions = session-level, sms_game_players = one row per
-- participant) rather than altering the existing solo table: a new
-- session-level table (sms_gamev2_live_sessions) + a participant join
-- table (sms_gamev2_live_participants), where each participant gets
-- their OWN sms_gamev2_sessions row once gameplay starts -- reusing
-- every existing engine/answer/scoring/reward code path per-student,
-- completely unchanged. Live Classroom's own new code is only the
-- lobby/presence/host-control layer sitting above that.
--
-- ISOLATION: same guarantee every prior GameRoom V2 migration makes --
-- nothing here touches any legacy sms_game_* table. join_code reuses
-- the EXISTING sms_generate_join_code() function (022_class_join_codes
-- .sql) since that's genuinely shared platform infrastructure (already
-- used by sms_classes.join_code), not legacy GameRoom code -- no
-- lib/gameRoom/* TypeScript is imported or duplicated.
--
-- AUTHORIZATION: "prevent students from joining unauthorized sessions"
-- is stricter here than legacy GameRoom's own join flow (which is
-- join-code-only, confirmed via audit -- ANY authenticated student with
-- a leaked code can join ANY teacher's legacy session). Live Classroom
-- requires BOTH the join code AND active enrollment
-- (sms_class_enrollments) in the class the session was hosted for --
-- see sms_gamev2_resolve_live_session_by_join_code()'s enrollment check
-- below.
-- =====================================================

-- =====================================================
-- LIVE SESSIONS -- one row per hosted live game. Status vocabulary is
-- intentionally its OWN enum (LOBBY/ACTIVE/PAUSED/ENDED), distinct from
-- both legacy's lowercase waiting/active/paused/ended and V2 solo's
-- CREATED/READY/ACTIVE/PAUSED/COMPLETED/ABANDONED -- a live session's
-- lifecycle is host-driven (the TEACHER decides when it starts/pauses/
-- ends), not derived from any one student's own progress, so it earns
-- its own vocabulary rather than overloading either existing one.
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_gamev2_live_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  join_code TEXT UNIQUE NOT NULL DEFAULT sms_generate_join_code(),
  host_teacher_id UUID NOT NULL REFERENCES sms_teachers(id) ON DELETE CASCADE,
  -- Which class this live session is FOR -- the concrete enforcement
  -- mechanism behind "prevent students from joining unauthorized
  -- sessions": a student must be actively enrolled in THIS class to
  -- join, not just possess the code. NOT NULL -- a live session always
  -- belongs to exactly one class (a teacher hosting for multiple
  -- classes at once would host multiple separate live sessions, one
  -- join code each, mirroring how a single legacy quiz session is also
  -- always a single event).
  class_id UUID NOT NULL REFERENCES sms_classes(id) ON DELETE CASCADE,
  question_set_id UUID NOT NULL REFERENCES sms_gamev2_question_sets(id) ON DELETE CASCADE,
  engine_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'LOBBY' CHECK (status IN ('LOBBY', 'ACTIVE', 'PAUSED', 'ENDED')),
  question_time_limit_seconds INT NOT NULL DEFAULT 20 CHECK (question_time_limit_seconds IN (10, 15, 20, 30, 60)),
  -- The shuffled question order every participant plays, generated ONCE
  -- when the host starts the game (not at lobby creation, so a teacher
  -- can wait for stragglers before the set is locked in) and copied
  -- onto each participant's own sms_gamev2_sessions row at that same
  -- moment -- every student in one live session answers the SAME
  -- questions in the SAME order, which a class-wide leaderboard/
  -- comparison needs to be meaningful.
  question_order UUID[] NOT NULL DEFAULT '{}',
  paused_at TIMESTAMP WITH TIME ZONE,
  pause_duration_seconds INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sms_gamev2_live_sessions_join_code ON sms_gamev2_live_sessions(join_code);
CREATE INDEX IF NOT EXISTS idx_sms_gamev2_live_sessions_host ON sms_gamev2_live_sessions(host_teacher_id);
CREATE INDEX IF NOT EXISTS idx_sms_gamev2_live_sessions_class ON sms_gamev2_live_sessions(class_id);

-- =====================================================
-- LIVE PARTICIPANTS -- one row per (live session, student). This is
-- BOTH the presence/roster record (lobby list, connected flag) AND the
-- bridge to a participant's own solo sms_gamev2_sessions row once
-- gameplay actually starts -- session_id is nullable specifically
-- because a participant exists (sitting in the lobby) before that
-- bridge row does.
--
-- `nickname` is SERVER-DERIVED from the student's own profile
-- (first_name + last initial -- see requireLiveSession.ts), never
-- student-supplied free text, matching legacy GameRoom's own
-- privacy-conscious precedent (nickname = "${first_name} ${last_name}")
-- adapted slightly (last initial only, not full last name) since a
-- live classroom roster is visible to every OTHER STUDENT in the
-- lobby, not just the teacher -- "do not expose personal student
-- information unnecessarily" means classmates seeing a full last name
-- on a shared screen is more exposure than a first-name+initial needs
-- to be. The teacher's own dashboard can still resolve a full name via
-- a join to sms_students/sms_profiles.
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_gamev2_live_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  live_session_id UUID NOT NULL REFERENCES sms_gamev2_live_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  -- The actual presence signal: flipped true on join/reconnect, false
  -- when the client's own heartbeat lapses (see the /heartbeat route --
  -- a student's tab actively marks itself disconnected on unmount too,
  -- but the authoritative "went quiet" detection is a stale
  -- last_seen_at, checked server-side, never a client's own claim of
  -- "I'm still here").
  connected BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  -- Bridges to this participant's own solo session row, created once
  -- the host starts the game -- NULL while still in the lobby. Every
  -- answer/scoring/pause/reward code path for this participant's actual
  -- gameplay is the EXISTING sms_gamev2_sessions/answer/complete
  -- machinery, completely unmodified -- Live Classroom only orchestrates
  -- WHEN that row gets created and WHICH question_order it starts with.
  session_id UUID REFERENCES sms_gamev2_sessions(id) ON DELETE SET NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (live_session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_gamev2_live_participants_session ON sms_gamev2_live_participants(live_session_id);
CREATE INDEX IF NOT EXISTS idx_sms_gamev2_live_participants_student ON sms_gamev2_live_participants(student_id);

ALTER TABLE sms_gamev2_live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_gamev2_live_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gamev2_live_sessions: admin all" ON sms_gamev2_live_sessions
  FOR ALL USING (sms_current_role() = 'admin');

-- The host teacher manages (reads AND writes -- start/pause/end) only
-- their own live sessions.
CREATE POLICY "gamev2_live_sessions: host teacher manage own" ON sms_gamev2_live_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sms_teachers t WHERE t.id = sms_gamev2_live_sessions.host_teacher_id AND t.profile_id = sms_current_user_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sms_teachers t WHERE t.id = sms_gamev2_live_sessions.host_teacher_id AND t.profile_id = sms_current_user_id())
  );

-- A student can READ (never write -- status changes are host-only) a
-- live session they are actually a participant of. This is what lets
-- Realtime push session status (LOBBY -> ACTIVE, PAUSED, ENDED) to
-- students who joined, without granting them any ability to see (let
-- alone join) a live session they never entered a join code for.
CREATE POLICY "gamev2_live_sessions: participant read own" ON sms_gamev2_live_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_gamev2_live_participants p
      JOIN sms_students s ON s.id = p.student_id
      WHERE p.live_session_id = sms_gamev2_live_sessions.id AND s.profile_id = sms_current_user_id()
    )
  );

CREATE POLICY "gamev2_live_participants: admin all" ON sms_gamev2_live_participants
  FOR ALL USING (sms_current_role() = 'admin');

-- The host teacher can read every participant of their own live
-- session (the lobby roster / presence view) but never write a
-- participant row directly -- joining/leaving/heartbeat are all
-- student-initiated actions on the student's OWN row (next policy);
-- the host only ever changes the SESSION's status, never a specific
-- participant's row, keeping "which student is in the lobby" entirely
-- self-reported-and-verified by that student's own client, not
-- something a teacher's client could spoof.
CREATE POLICY "gamev2_live_participants: host teacher read own session" ON sms_gamev2_live_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_gamev2_live_sessions ls
      JOIN sms_teachers t ON t.id = ls.host_teacher_id
      WHERE ls.id = sms_gamev2_live_participants.live_session_id AND t.profile_id = sms_current_user_id()
    )
  );

-- A student manages (reads AND writes) only their OWN participant row
-- -- covers join (insert), heartbeat/reconnect (update connected/
-- last_seen_at), and reading the roster to render "who else is here"
-- in their own lobby view (a student sees every participant of a live
-- session they're IN, per the USING clause on the shared session,
-- mirrored below for the student-facing roster read).
CREATE POLICY "gamev2_live_participants: student manage own" ON sms_gamev2_live_participants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_gamev2_live_participants.student_id AND s.profile_id = sms_current_user_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_gamev2_live_participants.student_id AND s.profile_id = sms_current_user_id())
  );

-- A student can also read every OTHER participant's row in a live
-- session they themselves have joined -- the actual data source for
-- "who else is in the lobby" on the student's own waiting-room screen.
-- Deliberately a separate, narrower policy from "manage own" above (a
-- student can SELECT any row in a session they're part of, but can
-- only INSERT/UPDATE/DELETE their own row -- Postgres RLS evaluates all
-- applicable policies as OR'd together for a given command, so this
-- adds read access without weakening the write restriction).
CREATE POLICY "gamev2_live_participants: student read own session roster" ON sms_gamev2_live_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_gamev2_live_participants self
      JOIN sms_students s ON s.id = self.student_id
      WHERE self.live_session_id = sms_gamev2_live_participants.live_session_id AND s.profile_id = sms_current_user_id()
    )
  );

-- Both tables need to be in the Realtime publication for postgres_changes
-- to push updates to subscribed clients (same mechanism migration 054
-- already proved out for legacy GameRoom's teacher dashboard).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sms_gamev2_live_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sms_gamev2_live_sessions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sms_gamev2_live_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sms_gamev2_live_participants;
  END IF;
END $$;

-- =====================================================
-- SECURITY DEFINER: resolves a join code to a live session, enforcing
-- BOTH checks "prevent students from joining unauthorized sessions"
-- needs -- (1) the code must resolve to a session that is still
-- LOBBY (can't join one that already started/ended), and (2) the
-- calling student must be ACTIVELY enrolled in the class that session
-- was hosted for. Runs as the definer specifically so a student who
-- has no RLS read access to sms_gamev2_live_sessions yet (they haven't
-- joined -- that's the whole point of this call) can still resolve the
-- code; the enrollment check inside is what makes this safe to expose
-- to any authenticated student rather than an open lookup.
-- =====================================================
CREATE OR REPLACE FUNCTION sms_gamev2_resolve_live_session_by_join_code(p_join_code TEXT, p_student_id UUID)
RETURNS TABLE (
  live_session_id UUID,
  status TEXT,
  class_id UUID,
  engine_id TEXT,
  question_set_id UUID,
  is_enrolled BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session sms_gamev2_live_sessions%ROWTYPE;
  v_enrolled BOOLEAN;
BEGIN
  SELECT * INTO v_session FROM sms_gamev2_live_sessions WHERE join_code = UPPER(p_join_code);

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM sms_class_enrollments ce
    WHERE ce.class_id = v_session.class_id AND ce.student_id = p_student_id AND ce.status = 'active'
  ) INTO v_enrolled;

  RETURN QUERY SELECT v_session.id, v_session.status, v_session.class_id, v_session.engine_id, v_session.question_set_id, v_enrolled;
END;
$$;

-- =====================================================
-- SECURITY DEFINER: starts a live session for the given set of
-- participant ids in one atomic call -- creates each participant's own
-- sms_gamev2_sessions row (the EXACT same shape sessions/start/route.ts
-- already creates for a solo session: status READY, the shared
-- question_order, current_index 0) and links it back via
-- sms_gamev2_live_participants.session_id. Runs as the definer because
-- this writes sms_gamev2_sessions rows for OTHER users (every
-- participant, not the calling teacher) -- something no ordinary
-- RLS policy permits and shouldn't: sms_gamev2_sessions' own
-- "student manage own" policy is exactly what prevents a teacher's
-- client from ever writing a session row for a student directly, so
-- this narrow, purpose-built function is the one exception, and only
-- ever invoked from the host-only /start route after that route has
-- already verified the caller owns this live session.
--
-- p_participant_ids (sms_gamev2_live_participants.id, not student_id)
-- is computed by the CALLING route via
-- lib/gameRoomV2/liveClassroom/presence.ts's isPresentlyConnected() --
-- kept as one shared TypeScript definition of "connected enough to
-- start" rather than a second, potentially-drifting staleness
-- threshold reimplemented in SQL.
-- =====================================================
CREATE OR REPLACE FUNCTION sms_gamev2_start_live_session(p_live_session_id UUID, p_question_order UUID[], p_participant_ids UUID[])
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_live sms_gamev2_live_sessions%ROWTYPE;
  v_participant RECORD;
  v_new_session_id UUID;
  v_started_count INT := 0;
BEGIN
  SELECT * INTO v_live FROM sms_gamev2_live_sessions WHERE id = p_live_session_id;
  IF NOT FOUND OR v_live.status != 'LOBBY' THEN
    RAISE EXCEPTION 'Live session is not in LOBBY status';
  END IF;

  FOR v_participant IN
    SELECT * FROM sms_gamev2_live_participants WHERE live_session_id = p_live_session_id AND id = ANY(p_participant_ids)
  LOOP
    INSERT INTO sms_gamev2_sessions (question_set_id, engine_id, student_id, status, question_order, current_index)
    VALUES (v_live.question_set_id, v_live.engine_id, v_participant.student_id, 'READY', p_question_order, 0)
    RETURNING id INTO v_new_session_id;

    UPDATE sms_gamev2_live_participants SET session_id = v_new_session_id WHERE id = v_participant.id;
    v_started_count := v_started_count + 1;
  END LOOP;

  UPDATE sms_gamev2_live_sessions
  SET status = 'ACTIVE', question_order = p_question_order, started_at = NOW()
  WHERE id = p_live_session_id;

  RETURN v_started_count;
END;
$$;

-- =====================================================
-- SECURITY DEFINER: pauses/resumes the live session's OWN status plus
-- every participant's individual sms_gamev2_sessions row in one atomic
-- call -- each participant keeps their own question timer, but the
-- host's single Pause button needs to freeze every one of them
-- together, mirroring legacy GameRoom's own
-- sms_shift_game_player_timers() precedent (there: one host action
-- shifts every player's timer; here: one host action pauses every
-- participant's own session row, each shifted correctly on resume).
-- Runs as definer for the same reason sms_gamev2_start_live_session
-- does: writing OTHER users' sms_gamev2_sessions rows is something no
-- ordinary RLS policy grants a teacher's client, by design.
-- =====================================================
CREATE OR REPLACE FUNCTION sms_gamev2_pause_live_session(p_live_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sms_gamev2_sessions
  SET status = 'PAUSED', paused_at = NOW()
  WHERE status = 'ACTIVE'
    AND id IN (SELECT session_id FROM sms_gamev2_live_participants WHERE live_session_id = p_live_session_id AND session_id IS NOT NULL);

  UPDATE sms_gamev2_live_sessions SET status = 'PAUSED', paused_at = NOW() WHERE id = p_live_session_id AND status = 'ACTIVE';
END;
$$;

CREATE OR REPLACE FUNCTION sms_gamev2_resume_live_session(p_live_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_live sms_gamev2_live_sessions%ROWTYPE;
  v_paused_for_seconds INT;
BEGIN
  SELECT * INTO v_live FROM sms_gamev2_live_sessions WHERE id = p_live_session_id;
  IF NOT FOUND OR v_live.status != 'PAUSED' THEN
    RAISE EXCEPTION 'Live session is not PAUSED';
  END IF;

  v_paused_for_seconds := COALESCE(ROUND(EXTRACT(EPOCH FROM (NOW() - v_live.paused_at))), 0);

  UPDATE sms_gamev2_sessions s
  SET status = 'ACTIVE',
      paused_at = NULL,
      current_question_started_at = COALESCE(s.current_question_started_at, NOW()) + (v_paused_for_seconds || ' seconds')::INTERVAL,
      pause_duration_seconds = s.pause_duration_seconds + v_paused_for_seconds
  FROM sms_gamev2_live_participants p
  WHERE p.session_id = s.id AND p.live_session_id = p_live_session_id AND s.status = 'PAUSED';

  UPDATE sms_gamev2_live_sessions
  SET status = 'ACTIVE', paused_at = NULL, pause_duration_seconds = pause_duration_seconds + v_paused_for_seconds
  WHERE id = p_live_session_id;
END;
$$;

-- =====================================================
-- SECURITY DEFINER: ends the live session -- marks it ENDED and
-- ABANDONS every participant's still-incomplete individual session (a
-- participant who already finished on their own, e.g. answered every
-- question before the teacher hit End, keeps their COMPLETED status
-- and real results untouched; only genuinely unfinished sessions are
-- abandoned, mirroring the ABANDONED status solo sessions already use
-- for "the game ended before this student finished").
-- =====================================================
CREATE OR REPLACE FUNCTION sms_gamev2_end_live_session(p_live_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sms_gamev2_sessions
  SET status = 'ABANDONED', abandoned_at = NOW()
  WHERE status IN ('CREATED', 'READY', 'ACTIVE', 'PAUSED')
    AND id IN (SELECT session_id FROM sms_gamev2_live_participants WHERE live_session_id = p_live_session_id AND session_id IS NOT NULL);

  UPDATE sms_gamev2_live_sessions SET status = 'ENDED', ended_at = NOW() WHERE id = p_live_session_id AND status != 'ENDED';
END;
$$;
