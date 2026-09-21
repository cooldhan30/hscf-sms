-- =====================================================
-- 072: CLASS-WIDE ASSIGNMENT SUBMISSION PROGRESS FOR STUDENTS
--
-- Students asked to see, for each assignment, which classmates have
-- submitted and which haven't -- a shared "everyone's turned it in but
-- you" nudge, with NO scores/marks visible (scores live in sms_grades,
-- a completely separate table this feature never touches).
--
-- Today a student can only read their OWN enrollment row and OWN
-- submission rows -- there's no policy letting them see a classmate's
-- name or submission status at all. This adds exactly that, scoped to
-- students who share an actual class enrollment, via a new
-- SECURITY DEFINER helper (same pattern as sms_teacher_owns_class from
-- 003/041) so the policy doesn't self-reference sms_class_enrollments
-- inside its own USING clause and risk the recursion this codebase has
-- hit before (003, 021, 067).
-- =====================================================

CREATE OR REPLACE FUNCTION sms_students_share_class(p_student_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM sms_class_enrollments mine
    JOIN sms_class_enrollments theirs ON theirs.class_id = mine.class_id
    JOIN sms_students s ON s.id = mine.student_id
    WHERE theirs.student_id = p_student_id
      AND s.profile_id = sms_current_user_id()
      AND mine.status = 'active'
      AND theirs.status = 'active'
  );
$$;

-- Roster visibility: a student can see a classmate's enrollment row
-- (which class, active status) for any class they share.
CREATE POLICY "enrollments: student read shared class roster" ON sms_class_enrollments
  FOR SELECT USING (sms_students_share_class(sms_class_enrollments.student_id));

-- Name visibility: a student can see a classmate's basic profile (name)
-- for display in the class progress list -- this policy grants row
-- access only, the API route below still explicitly selects just
-- id/first_name/last_name rather than every column.
CREATE POLICY "students: read shared class roster" ON sms_students
  FOR SELECT USING (sms_students_share_class(sms_students.id));

-- Submission-status visibility: a student can see THAT a classmate
-- submitted and when, for an assignment in a class they share --
-- sms_submissions has no score column at all (scores are in
-- sms_grades, untouched by this policy), so this is safe at the row
-- level; the API route additionally selects only
-- (assignment_id, student_id, submitted_at), never content/file_url/
-- audio_url, so classmates' actual submitted work stays private even
-- though this policy permits the row.
CREATE POLICY "submissions: student read shared class" ON sms_submissions
  FOR SELECT USING (sms_students_share_class(sms_submissions.student_id));
