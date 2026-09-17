-- =====================================================
-- 069: ATTENDANCE -- add 'holiday' status
--
-- sms_attendance.status is a plain TEXT column with a CHECK constraint
-- (004_teacher_portal.sql), not a native Postgres ENUM type, so adding
-- a new allowed value means dropping and recreating the constraint --
-- there's no ALTER TYPE ... ADD VALUE here (that's only for real enums).
-- 'holiday' lets a teacher mark a day as a school holiday rather than
-- forcing every student into present/absent/late/excused for a day
-- nobody was expected to attend; every attendance-percentage
-- calculation in the app excludes 'holiday' rows from both the
-- numerator and denominator (see lib/reports/studentReport.ts and the
-- student/parent dashboard tiles) so marking a holiday never affects a
-- student's attendance rate.
-- =====================================================

ALTER TABLE sms_attendance DROP CONSTRAINT IF EXISTS sms_attendance_status_check;
ALTER TABLE sms_attendance ADD CONSTRAINT sms_attendance_status_check
  CHECK (status IN ('present', 'absent', 'late', 'excused', 'holiday'));
