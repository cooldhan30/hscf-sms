-- =====================================================
-- FIX: teachers had no policy allowing them to UPDATE their
-- own sms_teachers row (only SELECT existed). The profile
-- self-edit PATCH silently no-opped -- Postgres doesn't error
-- on an UPDATE that RLS filters down to zero matching rows,
-- it just reports success with nothing changed. Confirmed via
-- a direct test: PATCH /api/teacher/profile returned 200 but
-- subject_specialty never actually changed.
-- =====================================================

CREATE POLICY "teachers: self update" ON sms_teachers
  FOR UPDATE USING (profile_id = auth.uid());

-- Column-level defense-in-depth, same pattern as sms_profiles:
-- even with row-level UPDATE now allowed, a teacher still can't
-- repoint their row to a different profile_id or edit the
-- admin-controlled employee_id via a raw API call.
REVOKE UPDATE (profile_id, employee_id) ON sms_teachers FROM authenticated;
