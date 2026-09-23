-- =====================================================
-- 082: GAMEROOM V2 BOSS BATTLE -- LIVE CLASSROOM COOPERATIVE MULTIPLAYER
--
-- Adds the shared boss configuration a cooperative live battle needs
-- (mirrors migration 081's race_difficulty precedent -- every
-- participant must fight the SAME boss at the SAME difficulty for the
-- fight to be one shared, meaningful class battle, unlike solo play's
-- per-student choice) and a read-only RPC returning every
-- participant's contribution summary.
--
-- Deliberately does NOT add a boss-health column or any other
-- server-side "current battle state" storage: boss HP is derived,
-- read-only, every request, from the SUM of every participant's
-- already-persisted sms_gamev2_sessions.correct_count (see
-- lib/gameRoomV2/bossBattle/coopBattle.ts's buildCoopBattleState) --
-- the identical "no new write path, nothing for a client to spoof"
-- architecture migration 081's Racing multiplayer already established.
-- =====================================================

ALTER TABLE sms_gamev2_live_sessions
  ADD COLUMN IF NOT EXISTS boss_id TEXT;

ALTER TABLE sms_gamev2_live_sessions
  ADD CONSTRAINT sms_gamev2_live_sessions_boss_id_valid
  CHECK (boss_id IS NULL OR boss_id IN ('suran', 'kotravai-guardian', 'naga-serpent'));

ALTER TABLE sms_gamev2_live_sessions
  ADD COLUMN IF NOT EXISTS boss_difficulty TEXT NOT NULL DEFAULT 'normal'
  CHECK (boss_difficulty IN ('easy', 'normal', 'hard'));

COMMENT ON COLUMN sms_gamev2_live_sessions.boss_id IS
  'Shared boss (see lib/gameRoomV2/bossBattle/bosses.ts) every participant in this live session cooperatively fights -- set once at host time (see HostLiveModal.tsx). NULL/meaningless for any engine other than boss-battle.';

COMMENT ON COLUMN sms_gamev2_live_sessions.boss_difficulty IS
  'Shared Boss Battle difficulty (easy/normal/hard) for every participant in this live session -- every attacker must run identical damage-per-correct-answer math for boss HP to be one honest shared total. Meaningless for any engine other than boss-battle.';

-- =====================================================
-- SECURITY DEFINER (read-only): returns every participant's
-- correct-answer count and streak fields for a live Boss Battle
-- session, so app/api/gameroom-v2/live/[id]/boss-battle/route.ts can
-- compute the shared boss HP total via
-- lib/gameRoomV2/bossBattle/coopBattle.ts's buildCoopBattleState --
-- the same reasoning as migration 081's sms_gamev2_get_live_race_state:
-- ordinary RLS on sms_gamev2_sessions only ever grants a student their
-- OWN row, but every student watching a cooperative battle needs to
-- see the CLASS's combined progress and every participant's individual
-- contribution for the "appropriate leaderboard/statistics" requirement.
--
-- Returns ONLY (participant_id, nickname, correct_count,
-- current_streak, best_streak) -- never score/XP/coins/individual
-- answer content, and specifically never answered_count or any
-- wrong-answer-derivable figure, since a wrong-answer count broadcast
-- to the whole class would be exactly the "naming/shaming" the
-- cooperative design avoids. Only positive contribution is ever
-- exposed.
--
-- Ownership check identical in shape to migration 081's racing RPC:
-- caller must be the live session's host OR an actual participant of
-- THIS specific session.
-- =====================================================
CREATE OR REPLACE FUNCTION sms_gamev2_get_live_boss_battle_state(p_live_session_id UUID)
RETURNS TABLE (
  participant_id UUID,
  nickname TEXT,
  correct_count INT,
  current_streak INT,
  best_streak INT
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
    COALESCE(sess.correct_count, 0),
    COALESCE(sess.current_streak, 0),
    COALESCE(sess.best_streak, 0)
  FROM sms_gamev2_live_participants p
  LEFT JOIN sms_gamev2_sessions sess ON sess.id = p.session_id
  WHERE p.live_session_id = p_live_session_id
  ORDER BY p.joined_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION sms_gamev2_get_live_boss_battle_state(UUID) FROM anon;
