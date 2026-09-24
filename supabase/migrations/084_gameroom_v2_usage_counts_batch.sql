-- =====================================================
-- 084: GAMEROOM V2 -- BATCHED QUESTION SET USAGE COUNTS
--
-- Performance only. The Library page and GET /api/gameroom-v2/question-sets
-- showed each set's usage count by calling
-- sms_gamev2_question_set_usage_count (075) once PER SET -- an N+1 that
-- grows with the library (100 sets = 100 RPC round trips on every Library
-- load). This returns every requested set's count in one call, using the
-- existing idx_sms_gamev2_usage_set index.
--
-- Same semantics and exposure as the single-set function: DUPLICATE +
-- ASSIGN events only (PREVIEW excluded), and only aggregate COUNTS, never
-- which teachers used a set. Sets with no usage are simply absent from the
-- result (the caller treats absence as 0). Read-only.
--
-- The app falls back to the per-set function if this one doesn't exist
-- yet (lib/gameRoomV2/questionSetUsage.ts), so deploying the code before
-- applying this migration is safe.
-- =====================================================
CREATE OR REPLACE FUNCTION sms_gamev2_question_set_usage_counts(p_question_set_ids UUID[])
RETURNS TABLE (question_set_id UUID, usage_count INT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.question_set_id, COUNT(*)::INT
  FROM sms_gamev2_question_set_usage u
  WHERE u.question_set_id = ANY(p_question_set_ids) AND u.action IN ('DUPLICATE', 'ASSIGN')
  GROUP BY u.question_set_id;
$$;

REVOKE ALL ON FUNCTION sms_gamev2_question_set_usage_counts(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sms_gamev2_question_set_usage_counts(UUID[]) TO authenticated, service_role;
