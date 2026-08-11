-- =====================================================
-- FIX: infinite recursion in sms_students/sms_parents RLS (introduced by 019)
-- =====================================================
-- 019's two new policies each wrapped only HALF the cross-table check in
-- a SECURITY DEFINER function -- "students: parent read requested" still
-- directly queried sms_parents inline (`EXISTS (SELECT 1 FROM sms_parents
-- p WHERE p.profile_id = ...)`), which is itself subject to sms_parents'
-- RLS, whose new "parents: student read requester" policy directly
-- queries sms_students right back. Same recursion class as 003 and 005:
-- wrapping only part of a cross-table check in SECURITY DEFINER doesn't
-- help if the policy still does its OWN inline join to the other table
-- outside that function.
--
-- Fix: move the entire check -- including "which parent/student am I"
-- -- inside the SECURITY DEFINER function, so the whole evaluation
-- bypasses RLS, not just the sms_parent_link_requests lookup.
-- =====================================================

DROP POLICY IF EXISTS "students: parent read requested" ON sms_students;
DROP POLICY IF EXISTS "parents: student read requester" ON sms_parents;
DROP FUNCTION IF EXISTS sms_has_link_request_between(UUID, UUID);

CREATE OR REPLACE FUNCTION sms_parent_has_pending_link_to(p_student_id UUID)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_parent_link_requests lr
    JOIN sms_parents p ON p.id = lr.parent_id
    WHERE lr.student_id = p_student_id AND p.profile_id = sms_current_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION sms_student_has_pending_link_from(p_parent_id UUID)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_parent_link_requests lr
    JOIN sms_students s ON s.id = lr.student_id
    WHERE lr.parent_id = p_parent_id AND s.profile_id = sms_current_user_id()
  );
$$;

CREATE POLICY "students: parent read requested" ON sms_students
  FOR SELECT USING (sms_parent_has_pending_link_to(id));

CREATE POLICY "parents: student read requester" ON sms_parents
  FOR SELECT USING (sms_student_has_pending_link_from(id));
