-- =====================================================
-- 044: ASSIGN A RESOURCE AS A READING EXERCISE
--
-- Rather than a parallel "resource completion" system, a resource can be
-- assigned by linking it to a real sms_assignments row -- due date, max
-- score, and the existing points_deduction_per_day late-penalty decay
-- (lib/points.ts) all just work, and completing it is a normal
-- sms_submissions row like any other assignment, so it already shows up
-- in the teacher's gradebook. resource_id is how the Resources page
-- tells "this assignment is really a reading exercise for that resource"
-- apart from a regular one.
-- =====================================================

ALTER TABLE sms_assignments ADD COLUMN IF NOT EXISTS resource_id UUID REFERENCES sms_resources(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sms_assignments_resource ON sms_assignments(resource_id);
