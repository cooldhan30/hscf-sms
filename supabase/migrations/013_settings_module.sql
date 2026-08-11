-- =====================================================
-- HSCF SCHOOL MANAGEMENT SYSTEM - SETTINGS MODULE (Phase 8)
-- =====================================================
-- All new tables here are admin-only (sms_current_role() = 'admin'),
-- matching the standing pattern from every prior phase. None of this
-- touches website_* or Tamizhi tables.
--
-- Scope notes (so future phases know the boundary):
--   - Grade levels / academic years / sections here are ADMIN-MANAGED
--     REFERENCE LISTS. GRADE_LEVEL_OPTIONS in lib/constants.ts stays the
--     source of truth for the 20+ existing consumers across teacher/
--     student/parent/reports -- rewiring all of them to read from
--     sms_grade_levels is a bigger, separate effort. Only the admin
--     Classes/Students creation forms are wired to sms_academic_years
--     going forward, since they had no academic-year picker before.
--   - "Roles & Permissions" is a read-only reference display in the UI,
--     not a dynamic permission editor -- role capabilities are already
--     enforced by RLS + the require-* guards; a fake editable permission
--     matrix that doesn't actually change enforcement would be
--     misleading.
--   - "Backup settings" stores an admin preference + supports a real
--     on-demand JSON export ("Download Backup Now"). It does not
--     schedule real automated backups -- there's no cron/worker in this
--     project, and Supabase already handles point-in-time recovery at
--     the infrastructure level.
--   - Email templates are editable text, not wired to a real send path
--     (same "queue but don't send" honesty established in Phase 6 --
--     no email provider is configured).
-- =====================================================

-- =====================================================
-- SCHOOL SETTINGS (singleton row)
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_school_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  school_name TEXT NOT NULL DEFAULT 'HSCF Tamil Academy',
  logo_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  current_academic_year TEXT NOT NULL DEFAULT '2026-2027',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
INSERT INTO sms_school_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE sms_school_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school_settings: admin all" ON sms_school_settings;
CREATE POLICY "school_settings: admin all" ON sms_school_settings FOR ALL USING (sms_current_role() = 'admin');

-- =====================================================
-- ACADEMIC YEARS
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_academic_years (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label TEXT UNIQUE NOT NULL,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Only one academic year may be marked current at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_academic_years_one_current
  ON sms_academic_years ((is_current)) WHERE is_current = true;

INSERT INTO sms_academic_years (label, is_current)
  VALUES ('2026-2027', true) ON CONFLICT (label) DO NOTHING;

ALTER TABLE sms_academic_years ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "academic_years: admin all" ON sms_academic_years;
CREATE POLICY "academic_years: admin all" ON sms_academic_years FOR ALL USING (sms_current_role() = 'admin');

-- =====================================================
-- GRADE LEVELS (admin-managed reference list)
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_grade_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  value TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO sms_grade_levels (value, label, sort_order) VALUES
  ('grade-1', 'Nilai 1', 1),
  ('grade-2', 'Nilai 2', 2),
  ('grade-3', 'Nilai 3', 3),
  ('grade-4', 'Nilai 4', 4),
  ('grade-5', 'Nilai 5', 5),
  ('grade-6', 'Nilai 6', 6),
  ('grade-7', 'Nilai 7', 7),
  ('grade-8', 'Nilai 8', 8),
  ('biliteracy-seal', 'Biliteracy Seal Course', 9),
  ('tamil-diploma', 'Tamil Diploma Program', 10)
ON CONFLICT (value) DO NOTHING;

ALTER TABLE sms_grade_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "grade_levels: admin all" ON sms_grade_levels;
CREATE POLICY "grade_levels: admin all" ON sms_grade_levels FOR ALL USING (sms_current_role() = 'admin');

-- =====================================================
-- SECTIONS (admin-managed reference list)
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE sms_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sections: admin all" ON sms_sections;
CREATE POLICY "sections: admin all" ON sms_sections FOR ALL USING (sms_current_role() = 'admin');

-- =====================================================
-- SCHOOL CALENDAR
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  end_date DATE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE sms_calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calendar_events: admin all" ON sms_calendar_events;
CREATE POLICY "calendar_events: admin all" ON sms_calendar_events FOR ALL USING (sms_current_role() = 'admin');

-- =====================================================
-- EMAIL TEMPLATES (editable text, not wired to a real send path)
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO sms_email_templates (key, name, subject, body) VALUES
  ('welcome', 'Welcome Email', 'Welcome to HSCF Tamil Academy', 'Hi {{first_name}}, welcome to HSCF Tamil Academy! Your account is ready.'),
  ('password_reset', 'Password Reset', 'Your password has been reset', 'Hi {{first_name}}, an administrator has reset your password. Your temporary password is {{temp_password}}.'),
  ('announcement_notify', 'Announcement Notification', 'New announcement: {{title}}', 'Hi {{first_name}}, a new announcement "{{title}}" has been posted.')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE sms_email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_templates: admin all" ON sms_email_templates;
CREATE POLICY "email_templates: admin all" ON sms_email_templates FOR ALL USING (sms_current_role() = 'admin');

-- =====================================================
-- NOTIFICATION SETTINGS (singleton row)
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_notification_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  notify_email_enabled BOOLEAN NOT NULL DEFAULT true,
  notify_push_enabled BOOLEAN NOT NULL DEFAULT false,
  digest_frequency TEXT NOT NULL DEFAULT 'immediate' CHECK (digest_frequency IN ('immediate', 'daily', 'weekly')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
INSERT INTO sms_notification_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE sms_notification_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notification_settings: admin all" ON sms_notification_settings;
CREATE POLICY "notification_settings: admin all" ON sms_notification_settings FOR ALL USING (sms_current_role() = 'admin');

-- =====================================================
-- BACKUP SETTINGS (singleton row)
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_backup_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  auto_backup_enabled BOOLEAN NOT NULL DEFAULT false,
  backup_frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (backup_frequency IN ('daily', 'weekly', 'monthly')),
  retention_days INT NOT NULL DEFAULT 30,
  last_backup_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
INSERT INTO sms_backup_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE sms_backup_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "backup_settings: admin all" ON sms_backup_settings;
CREATE POLICY "backup_settings: admin all" ON sms_backup_settings FOR ALL USING (sms_current_role() = 'admin');
