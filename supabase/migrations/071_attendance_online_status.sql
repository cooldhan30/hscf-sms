-- =====================================================
-- 071: ATTENDANCE -- add 'online' status
--
-- Same pattern as 069's 'holiday' addition: sms_attendance.status is a
-- plain TEXT column with a CHECK constraint (not a native Postgres
-- ENUM), so a new allowed value means dropping and recreating the
-- constraint.
--
-- Unlike 'holiday' (excluded from attendance-rate calculations
-- entirely, since a holiday isn't a school day anyone could attend),
-- 'online' counts as full attendance credit everywhere the app checks
-- for 'present' -- attending remotely is still attending. See the
-- application-layer changes alongside this migration for the exact
-- call sites.
-- =====================================================

ALTER TABLE sms_attendance DROP CONSTRAINT IF EXISTS sms_attendance_status_check;
ALTER TABLE sms_attendance ADD CONSTRAINT sms_attendance_status_check
  CHECK (status IN ('present', 'absent', 'late', 'excused', 'holiday', 'online'));
