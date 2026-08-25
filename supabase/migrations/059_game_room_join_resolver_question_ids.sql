-- =====================================================
-- 059: GAME ROOM -- join resolver also returns question_ids
--
-- A joining student's own RLS grants no SELECT on a teacher-hosted
-- session's row until AFTER they've joined (058 fixes read access for
-- an EXISTING player, but a first-time join has no player row yet to
-- prove membership). join/route.ts previously did a separate direct
-- table read for question_ids after resolving the code, which silently
-- returned nothing for the same reason "Game session not found" showed
-- up for any first-time teacher-hosted join. Folding question_ids into
-- this same SECURITY DEFINER lookup (which already legitimately bypasses
-- RLS to resolve the code at all) removes that second, failing read
-- entirely instead of working around it.
-- =====================================================

CREATE OR REPLACE FUNCTION sms_resolve_game_session_by_join_code(p_code TEXT)
RETURNS TABLE (session_id UUID, status TEXT, game_type TEXT, question_ids TEXT[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, status, game_type, question_ids FROM sms_game_sessions WHERE join_code = p_code;
$$;
