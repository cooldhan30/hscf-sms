-- =====================================================
-- FIX: infinite recursion in sms_parents RLS (introduced by 004)
-- =====================================================
-- "parents: teacher read own students parents" queried
-- sms_student_parents directly. sms_student_parents' own
-- "parent read own links" policy queries sms_parents right
-- back -- the same recursion class fixed in migration 003,
-- reintroduced here. This surfaced as soon as anything
-- inserted into a table with a foreign key to sms_students
-- (e.g. sms_attendance, sms_assignments' grading path),
-- because the FK check requires evaluating sms_students' own
-- "parent read own children" policy, which queries
-- sms_student_parents, which chains into this cycle.
--
-- Fix: same pattern as always -- route the cross-table check
-- through a SECURITY DEFINER function.
-- =====================================================

CREATE OR REPLACE FUNCTION sms_parent_manages_taught_student(p_parent_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_student_parents sp
    WHERE sp.parent_id = p_parent_id AND sms_teacher_teaches_student(sp.student_id)
  );
$$;

DROP POLICY IF EXISTS "parents: teacher read own students parents" ON sms_parents;
CREATE POLICY "parents: teacher read own students parents" ON sms_parents
  FOR SELECT USING (sms_parent_manages_taught_student(id));
