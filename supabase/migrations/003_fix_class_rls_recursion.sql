-- =====================================================
-- FIX: infinite recursion in sms_classes / sms_class_enrollments RLS
-- =====================================================
-- sms_classes' student/parent read policies queried
-- sms_class_enrollments directly, and sms_class_enrollments'
-- teacher read policy queried sms_classes directly -- a
-- circular reference Postgres detects and rejects with
-- "infinite recursion detected in policy for relation".
--
-- Fix: route the cross-table checks through SECURITY DEFINER
-- helper functions (same pattern as sms_current_role()),
-- whose internal queries bypass RLS on the table they read,
-- breaking the cycle.
-- =====================================================

CREATE OR REPLACE FUNCTION sms_teacher_owns_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_classes c
    JOIN sms_teachers t ON t.id = c.teacher_id
    WHERE c.id = p_class_id AND t.profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION sms_user_enrolled_in_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_class_enrollments ce
    JOIN sms_students s ON s.id = ce.student_id
    WHERE ce.class_id = p_class_id AND s.profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION sms_user_parent_of_class_student(p_class_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_class_enrollments ce
    JOIN sms_student_parents sp ON sp.student_id = ce.student_id
    JOIN sms_parents p ON p.id = sp.parent_id
    WHERE ce.class_id = p_class_id AND p.profile_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "classes: student read enrolled" ON sms_classes;
CREATE POLICY "classes: student read enrolled" ON sms_classes
  FOR SELECT USING (sms_user_enrolled_in_class(id));

DROP POLICY IF EXISTS "classes: parent read child classes" ON sms_classes;
CREATE POLICY "classes: parent read child classes" ON sms_classes
  FOR SELECT USING (sms_user_parent_of_class_student(id));

DROP POLICY IF EXISTS "enrollments: teacher read own class rosters" ON sms_class_enrollments;
CREATE POLICY "enrollments: teacher read own class rosters" ON sms_class_enrollments
  FOR SELECT USING (sms_teacher_owns_class(class_id));
