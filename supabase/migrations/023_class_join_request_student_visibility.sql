-- =====================================================
-- FIX: teacher's "Pending Join Requests" list crashes rendering the
-- requesting student's name
-- =====================================================
-- app/teacher/classes/[id]/PendingJoinRequests.tsx embeds
-- student:sms_students(first_name, last_name) on sms_class_join_requests.
-- "students: teacher read own" only covers students already enrolled
-- (via sms_teacher_teaches_student, which checks sms_class_enrollments)
-- -- a student with only a PENDING request isn't enrolled yet, so the
-- embed comes back null and the page crashes on `.first_name`. Same bug
-- class as 019/021 (parent-link visibility), fixed the same way learned
-- from 021's mistake: the entire cross-table check -- including "which
-- teacher am I" -- lives inside one SECURITY DEFINER function, not
-- split across an inline join plus a helper, so there's no recursion
-- surface at all regardless of what sms_class_join_requests' own
-- policies do.
-- =====================================================

CREATE OR REPLACE FUNCTION sms_teacher_has_pending_join_request_from(p_student_id UUID)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_class_join_requests jr
    JOIN sms_classes c ON c.id = jr.class_id
    JOIN sms_teachers t ON t.id = c.teacher_id
    WHERE jr.student_id = p_student_id AND t.profile_id = sms_current_user_id()
  );
$$;

CREATE POLICY "students: teacher read pending join request" ON sms_students
  FOR SELECT USING (sms_teacher_has_pending_join_request_from(id));
