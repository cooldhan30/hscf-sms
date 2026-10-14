-- =====================================================
-- 098: GAMEROOM CLASSIC -- CO-TEACHERS SEE ASSIGNMENT RESULTS
--
-- Every teacher of a class an assignment was given to can now READ that
-- assignment and its results (who submitted, scores, answers). Only the
-- teacher who made the assignment can still change it (deadline, close,
-- extra attempts, settings) -- the 095 "manage own" policies are unchanged.
--
-- ISOLATION: touches only GameRoom Classic. Adds one new sms_grc_*
-- function and new read-only (SELECT) policies on the 095 sms_grc_*
-- tables. No existing table, column, function, policy or row is changed.
--
-- The helper is SECURITY DEFINER so the policies below do not query each
-- other through RLS (which Postgres would reject as infinite recursion).
-- It answers one question only: does the signed-in teacher teach a class
-- this assignment was given to? It reuses sms_teacher_owns_class().
--
-- Run the whole file in the Supabase SQL editor (nothing selected, then
-- Run). Safe to run more than once.
--
-- Rollback:
--   DROP POLICY "grc_assignments: co-teacher read" ON sms_grc_assignments;
--   DROP POLICY "grc_assignment_classes: co-teacher read" ON sms_grc_assignment_classes;
--   DROP POLICY "grc_assignment_content: co-teacher read" ON sms_grc_assignment_content;
--   DROP POLICY "grc_attempt_grants: co-teacher read" ON sms_grc_attempt_grants;
--   DROP POLICY "grc_attempts: co-teacher read" ON sms_grc_attempts;
--   DROP POLICY "grc_responses: co-teacher read" ON sms_grc_responses;
--   DROP FUNCTION sms_grc_teaches_assignment(UUID);
-- =====================================================

CREATE OR REPLACE FUNCTION sms_grc_teaches_assignment(p_assignment_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT sms_current_role() = 'teacher'
    AND EXISTS (
      SELECT 1 FROM sms_grc_assignment_classes ac
      WHERE ac.assignment_id = p_assignment_id AND sms_teacher_owns_class(ac.class_id)
    );
$fn$;

REVOKE ALL ON FUNCTION sms_grc_teaches_assignment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sms_grc_teaches_assignment(UUID) TO authenticated;

DROP POLICY IF EXISTS "grc_assignments: co-teacher read" ON sms_grc_assignments;
CREATE POLICY "grc_assignments: co-teacher read" ON sms_grc_assignments
  FOR SELECT USING (sms_grc_teaches_assignment(id));

DROP POLICY IF EXISTS "grc_assignment_classes: co-teacher read" ON sms_grc_assignment_classes;
CREATE POLICY "grc_assignment_classes: co-teacher read" ON sms_grc_assignment_classes
  FOR SELECT USING (sms_grc_teaches_assignment(assignment_id));

DROP POLICY IF EXISTS "grc_assignment_content: co-teacher read" ON sms_grc_assignment_content;
CREATE POLICY "grc_assignment_content: co-teacher read" ON sms_grc_assignment_content
  FOR SELECT USING (sms_grc_teaches_assignment(assignment_id));

DROP POLICY IF EXISTS "grc_attempt_grants: co-teacher read" ON sms_grc_attempt_grants;
CREATE POLICY "grc_attempt_grants: co-teacher read" ON sms_grc_attempt_grants
  FOR SELECT USING (sms_grc_teaches_assignment(assignment_id));

DROP POLICY IF EXISTS "grc_attempts: co-teacher read" ON sms_grc_attempts;
CREATE POLICY "grc_attempts: co-teacher read" ON sms_grc_attempts
  FOR SELECT USING (sms_grc_teaches_assignment(assignment_id));

DROP POLICY IF EXISTS "grc_responses: co-teacher read" ON sms_grc_responses;
CREATE POLICY "grc_responses: co-teacher read" ON sms_grc_responses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_grc_attempts t WHERE t.id = sms_grc_responses.attempt_id AND sms_grc_teaches_assignment(t.assignment_id))
  );
