-- =====================================================
-- FIX: parent/student can't see each other's name on a pending link request
-- =====================================================
-- app/parent/children/page.tsx embeds student:sms_students(first_name,
-- last_name) on sms_parent_link_requests, and app/student/link-requests/
-- page.tsx embeds parent:sms_parents(...) the same way. PostgREST still
-- enforces RLS on an embedded resource -- and "students: parent read own
-- children" / "parents: self read" only allow that once
-- sms_student_parents already has a row (i.e. the link is approved), not
-- while a request is merely pending. The embed silently comes back null,
-- and both pages crash on `.first_name` of a null object.
--
-- Fix: a SECURITY DEFINER helper (same pattern as every other cross-table
-- visibility case in this app -- 003, 004, 005) plus two narrow SELECT
-- policies scoped to exactly the rows involved in an existing
-- sms_parent_link_requests row between that pair, regardless of status.
-- =====================================================

CREATE OR REPLACE FUNCTION sms_has_link_request_between(p_parent_id UUID, p_student_id UUID)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_parent_link_requests
    WHERE parent_id = p_parent_id AND student_id = p_student_id
  );
$$;

CREATE POLICY "students: parent read requested" ON sms_students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_parents p
      WHERE p.profile_id = sms_current_user_id() AND sms_has_link_request_between(p.id, sms_students.id)
    )
  );

CREATE POLICY "parents: student read requester" ON sms_parents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_students s
      WHERE s.profile_id = sms_current_user_id() AND sms_has_link_request_between(sms_parents.id, s.id)
    )
  );
