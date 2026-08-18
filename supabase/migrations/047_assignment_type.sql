-- =====================================================
-- 047: ASSIGNMENT TYPE (ASSIGNMENT VS EXAM)
--
-- sms_grades is scored per sms_assignments row regardless of whether the
-- work was a homework assignment or an exam -- there was no way to tell
-- the two apart. The new Score Report needs to break totals out by type
-- ("assignment total" vs "exam total"), so this tags each row instead of
-- adding a second, parallel exams table that would duplicate the grading
-- machinery (sms_grades, gradebook UI, submission flow) for no reason.
-- Existing rows default to 'assignment' -- nothing before this migration
-- was ever an exam.
-- =====================================================

ALTER TABLE sms_assignments
  ADD COLUMN IF NOT EXISTS assignment_type TEXT NOT NULL DEFAULT 'assignment'
  CHECK (assignment_type IN ('assignment', 'exam'));
