-- =====================================================
-- FIX: grades RLS didn't verify the student is actually
-- enrolled in the assignment's class
-- =====================================================
-- "grades: teacher manage own assignment" only checked that
-- the teacher owns the assignment's class -- it never checked
-- that student_id belongs to that class. A teacher could
-- insert a grade row for ANY student system-wide (including
-- another teacher's student) as long as they owned the
-- assignment. Confirmed via a direct test: inserting a grade
-- for a different teacher's student under your own assignment
-- succeeded when it should have been rejected.
-- =====================================================

CREATE OR REPLACE FUNCTION sms_teacher_can_grade(p_assignment_id uuid, p_student_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_assignments a
    JOIN sms_class_enrollments ce ON ce.class_id = a.class_id AND ce.student_id = p_student_id
    WHERE a.id = p_assignment_id AND sms_teacher_owns_class(a.class_id)
  );
$$;

DROP POLICY IF EXISTS "grades: teacher manage own assignment" ON sms_grades;
CREATE POLICY "grades: teacher manage own assignment" ON sms_grades
  FOR ALL USING (sms_teacher_can_grade(assignment_id, student_id));
