-- =====================================================
-- HSCF SCHOOL MANAGEMENT SYSTEM - STUDENT PORTAL (Phase 4)
-- =====================================================
-- Adds sms_profiles.address (self-editable, like phone) and
-- sms_announcements.school_wide (a simple boolean column --
-- no join/recursion risk, so a plain policy is safe here).
-- Existing read RLS for students (classes, assignments,
-- grades, attendance) already came from Phases 1 & 3; no
-- changes needed there. Does not touch any website_* table.
-- =====================================================

ALTER TABLE sms_profiles ADD COLUMN IF NOT EXISTS address TEXT;

-- Additive: column grants stack, this doesn't replace the
-- migration 008 grant (first_name, last_name, phone, avatar_url).
GRANT UPDATE (address) ON sms_profiles TO authenticated;

ALTER TABLE sms_announcements ADD COLUMN IF NOT EXISTS school_wide BOOLEAN NOT NULL DEFAULT false;

CREATE POLICY "announcements: anyone read school-wide" ON sms_announcements
  FOR SELECT USING (school_wide = true);
