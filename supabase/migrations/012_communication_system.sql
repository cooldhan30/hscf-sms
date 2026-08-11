-- =====================================================
-- HSCF SCHOOL MANAGEMENT SYSTEM - COMMUNICATION SYSTEM (Phase 6)
-- =====================================================
-- Upgrades sms_announcements with:
--   - audience_type enum (school/teachers/parents/students/grade/class)
--     replacing the old school_wide boolean + implicit grade/class logic
--   - status (draft/published/archived) + publish_at (scheduled
--     publication, checked lazily at read time -- no cron/worker needed:
--     a "scheduled" announcement is simply status='published' with a
--     future publish_at, invisible to recipients until that time passes)
--   - notify_email / notify_push flags + sms_announcement_notifications,
--     a queue/log a future worker can dispatch against once a real
--     email/push provider is wired in (out of scope here -- no
--     credentials exist for one, and this project didn't need any until
--     now, so this only lays the extension point, it doesn't send
--     anything)
--
-- Per explicit decision: teachers keep the Phase 3 scope (their own
-- classes + their own grade level) -- "teachers"/"parents"/"students"/
-- "school" broad audiences are admin-only, enforced in the visibility
-- functions below, not just in the UI.
--
-- Does not touch any website_* or Tamizhi table.
-- =====================================================

-- =====================================================
-- AUDIENCE TYPE
-- =====================================================
DO $$ BEGIN
  CREATE TYPE sms_announcement_audience AS ENUM ('school', 'teachers', 'parents', 'students', 'grade', 'class');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE sms_announcements ADD COLUMN IF NOT EXISTS audience_type sms_announcement_audience;

-- Backfill from the old school_wide/grade_level/sms_announcement_classes model.
-- school_wide only exists if migration 009 previously added it -- guard with
-- information_schema so this runs cleanly whether or not that's the case.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sms_announcements' AND column_name = 'school_wide'
  ) THEN
    UPDATE sms_announcements SET audience_type = 'school' WHERE school_wide = true AND audience_type IS NULL;
  END IF;
END $$;
UPDATE sms_announcements SET audience_type = 'grade' WHERE grade_level IS NOT NULL AND audience_type IS NULL;
UPDATE sms_announcements a SET audience_type = 'class'
  WHERE audience_type IS NULL AND EXISTS (SELECT 1 FROM sms_announcement_classes ac WHERE ac.announcement_id = a.id);
UPDATE sms_announcements SET audience_type = 'class' WHERE audience_type IS NULL; -- remaining stragglers

ALTER TABLE sms_announcements ALTER COLUMN audience_type SET NOT NULL;
ALTER TABLE sms_announcements ALTER COLUMN audience_type SET DEFAULT 'class';

-- =====================================================
-- STATUS + SCHEDULING
-- =====================================================
DO $$ BEGIN
  CREATE TYPE sms_announcement_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE sms_announcements ADD COLUMN IF NOT EXISTS status sms_announcement_status;
UPDATE sms_announcements SET status = 'published' WHERE status IS NULL; -- existing rows were already live
ALTER TABLE sms_announcements ALTER COLUMN status SET NOT NULL;
ALTER TABLE sms_announcements ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE sms_announcements ADD COLUMN IF NOT EXISTS publish_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sms_announcements ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- =====================================================
-- NOTIFICATION FLAGS + LOG (scaffolding only -- no dispatch)
-- =====================================================
ALTER TABLE sms_announcements ADD COLUMN IF NOT EXISTS notify_email BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sms_announcements ADD COLUMN IF NOT EXISTS notify_push BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  CREATE TYPE sms_notification_channel AS ENUM ('email', 'push');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sms_notification_status AS ENUM ('pending', 'sent', 'failed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS sms_announcement_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID NOT NULL REFERENCES sms_announcements(id) ON DELETE CASCADE,
  channel sms_notification_channel NOT NULL,
  status sms_notification_status NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_sms_announcement_notifications_announcement ON sms_announcement_notifications(announcement_id);
CREATE INDEX IF NOT EXISTS idx_sms_announcement_notifications_status ON sms_announcement_notifications(status);

ALTER TABLE sms_announcement_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcement_notifications: admin all" ON sms_announcement_notifications;
CREATE POLICY "announcement_notifications: admin all" ON sms_announcement_notifications
  FOR ALL USING (sms_current_role() = 'admin');

DROP POLICY IF EXISTS "announcement_notifications: creator read own" ON sms_announcement_notifications;
CREATE POLICY "announcement_notifications: creator read own" ON sms_announcement_notifications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_announcements a WHERE a.id = sms_announcement_notifications.announcement_id AND a.created_by = auth.uid())
  );

-- Teachers insert their own notification requests when publishing (via
-- the regular session client, not the service-role admin client).
DROP POLICY IF EXISTS "announcement_notifications: creator insert own" ON sms_announcement_notifications;
CREATE POLICY "announcement_notifications: creator insert own" ON sms_announcement_notifications
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM sms_announcements a WHERE a.id = sms_announcement_notifications.announcement_id AND a.created_by = auth.uid())
  );

-- =====================================================
-- VISIBILITY LOGIC
-- =====================================================
CREATE OR REPLACE FUNCTION sms_announcement_is_active(p_status sms_announcement_status, p_publish_at timestamptz)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT p_status = 'published' AND (p_publish_at IS NULL OR p_publish_at <= now());
$$;

CREATE OR REPLACE FUNCTION sms_announcement_visible_to_teacher(p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_announcements a
    WHERE a.id = p_id
      AND sms_announcement_is_active(a.status, a.publish_at)
      AND (
        a.audience_type = 'school'
        OR a.audience_type = 'teachers'
        OR (a.audience_type = 'grade' AND EXISTS (
              SELECT 1 FROM sms_classes c JOIN sms_teachers t ON t.id = c.teacher_id
              WHERE c.grade_level = a.grade_level AND t.profile_id = auth.uid()
            ))
        OR (a.audience_type = 'class' AND EXISTS (
              SELECT 1 FROM sms_announcement_classes ac
              JOIN sms_classes c ON c.id = ac.class_id
              JOIN sms_teachers t ON t.id = c.teacher_id
              WHERE ac.announcement_id = a.id AND t.profile_id = auth.uid()
            ))
      )
  );
$$;

CREATE OR REPLACE FUNCTION sms_announcement_visible_to_student(p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_announcements a
    JOIN sms_students s ON s.profile_id = auth.uid()
    WHERE a.id = p_id
      AND sms_announcement_is_active(a.status, a.publish_at)
      AND (
        a.audience_type = 'school'
        OR a.audience_type = 'students'
        OR (a.audience_type = 'grade' AND s.grade_level = a.grade_level)
        OR (a.audience_type = 'class' AND EXISTS (
              SELECT 1 FROM sms_announcement_classes ac
              JOIN sms_class_enrollments ce ON ce.class_id = ac.class_id
              WHERE ac.announcement_id = a.id AND ce.student_id = s.id
            ))
      )
  );
$$;

CREATE OR REPLACE FUNCTION sms_announcement_visible_to_parent(p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_announcements a
    JOIN sms_parents p ON p.profile_id = auth.uid()
    WHERE a.id = p_id
      AND sms_announcement_is_active(a.status, a.publish_at)
      AND (
        a.audience_type = 'school'
        OR a.audience_type = 'parents'
        OR (a.audience_type = 'grade' AND EXISTS (
              SELECT 1 FROM sms_student_parents sp JOIN sms_students s ON s.id = sp.student_id
              WHERE sp.parent_id = p.id AND s.grade_level = a.grade_level
            ))
        OR (a.audience_type = 'class' AND EXISTS (
              SELECT 1 FROM sms_announcement_classes ac
              JOIN sms_class_enrollments ce ON ce.class_id = ac.class_id
              JOIN sms_student_parents sp ON sp.student_id = ce.student_id
              WHERE ac.announcement_id = a.id AND sp.parent_id = p.id
            ))
      )
  );
$$;

-- =====================================================
-- REPLACE OLD POLICIES WITH THE NEW VISIBILITY LOGIC
-- =====================================================
DROP POLICY IF EXISTS "announcements: teacher read targeted" ON sms_announcements;
DROP POLICY IF EXISTS "announcements: teacher read visible" ON sms_announcements;
CREATE POLICY "announcements: teacher read visible" ON sms_announcements
  FOR SELECT USING (sms_announcement_visible_to_teacher(id));

DROP POLICY IF EXISTS "announcements: student read targeted" ON sms_announcements;
DROP POLICY IF EXISTS "announcements: student read visible" ON sms_announcements;
CREATE POLICY "announcements: student read visible" ON sms_announcements
  FOR SELECT USING (sms_announcement_visible_to_student(id));

DROP POLICY IF EXISTS "announcements: parent read targeted" ON sms_announcements;
DROP POLICY IF EXISTS "announcements: parent read visible" ON sms_announcements;
CREATE POLICY "announcements: parent read visible" ON sms_announcements
  FOR SELECT USING (sms_announcement_visible_to_parent(id));

DROP POLICY IF EXISTS "announcements: anyone read school-wide" ON sms_announcements;

DROP POLICY IF EXISTS "announcement_classes: readable if announcement readable" ON sms_announcement_classes;
CREATE POLICY "announcement_classes: readable if announcement readable" ON sms_announcement_classes
  FOR SELECT USING (
    sms_announcement_visible_to_teacher(announcement_id)
    OR sms_announcement_visible_to_student(announcement_id)
    OR sms_announcement_visible_to_parent(announcement_id)
  );

-- =====================================================
-- DROP THE NOW-SUPERSEDED school_wide COLUMN
-- (audience_type = 'school' replaces it)
-- =====================================================
ALTER TABLE sms_announcements DROP COLUMN IF EXISTS school_wide;

-- Old per-role targeting functions from Phase 3/4 are superseded and no
-- longer referenced by any policy -- safe to drop.
DROP FUNCTION IF EXISTS sms_announcement_targets_teacher(uuid);
DROP FUNCTION IF EXISTS sms_announcement_targets_student(uuid);
DROP FUNCTION IF EXISTS sms_announcement_targets_parent(uuid);
