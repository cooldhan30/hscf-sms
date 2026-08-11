-- =====================================================
-- HELPER: look up a student by their account email.
-- =====================================================
-- "profiles: read own" restricts sms_profiles SELECT to the caller's
-- own row, so a parent's RLS-scoped session client can't read an
-- arbitrary student's profile by email to start a link request. This
-- SECURITY DEFINER function is the narrow, read-only escape hatch --
-- it only ever returns a student_id (no PII), and only for accounts
-- with role = 'student'.
-- =====================================================

CREATE OR REPLACE FUNCTION sms_find_student_by_email(p_email TEXT)
RETURNS TABLE (student_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM sms_students s
  JOIN sms_profiles p ON p.id = s.profile_id
  WHERE p.email = p_email AND p.role = 'student';
$$;
