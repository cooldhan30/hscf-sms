-- =====================================================
-- FIX: "Your requests" lists crash rendering the class name
-- =====================================================
-- Both app/teacher/classes/page.tsx and app/student/classes/page.tsx
-- embed class:sms_classes(name) on their own pending/denied requests.
-- "classes: teacher read own" / a student's enrolled-only read scope
-- only cover a class the requester is already attached to -- a merely
-- PENDING (or denied) request doesn't grant that yet, so the embed
-- comes back null and both pages crash the same way 023 just fixed on
-- the teacher's own roster page. Same fully-self-contained SECURITY
-- DEFINER shape as 023, applied to sms_classes this time.
-- =====================================================

CREATE OR REPLACE FUNCTION sms_teacher_has_class_teacher_request(p_class_id UUID)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_class_teacher_requests ctr
    JOIN sms_teachers t ON t.id = ctr.teacher_id
    WHERE ctr.class_id = p_class_id AND t.profile_id = sms_current_user_id()
  );
$$;

CREATE POLICY "classes: teacher read requested" ON sms_classes
  FOR SELECT USING (sms_teacher_has_class_teacher_request(id));

CREATE OR REPLACE FUNCTION sms_student_has_class_join_request(p_class_id UUID)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_class_join_requests jr
    JOIN sms_students s ON s.id = jr.student_id
    WHERE jr.class_id = p_class_id AND s.profile_id = sms_current_user_id()
  );
$$;

CREATE POLICY "classes: student read requested" ON sms_classes
  FOR SELECT USING (sms_student_has_class_join_request(id));
