-- =====================================================
-- HSCF SCHOOL MANAGEMENT SYSTEM - ADMIN CORE (Phase 2)
-- =====================================================
-- Adds: profiles.email/is_active, teachers.employee_id,
-- sms_classes, sms_class_enrollments. Extends the new-user
-- trigger to also copy email. Does NOT touch any website_*
-- or Tamizhi table -- only reads/updates website_registrations
-- happen from application code (registration_status is a
-- column that table already defines for exactly this purpose).
-- =====================================================

-- =====================================================
-- SMS_PROFILES: add email (denormalized from auth.users,
-- needed because PostgREST/RLS clients can't query auth.users
-- directly) and is_active (soft-disable switch)
-- =====================================================
ALTER TABLE sms_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE sms_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- =====================================================
-- SMS_TEACHERS: employee_id
-- =====================================================
ALTER TABLE sms_teachers ADD COLUMN IF NOT EXISTS employee_id TEXT UNIQUE;

-- =====================================================
-- SMS_CLASSES
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  grade_level TEXT, -- reuses the Nilai 1-8 / biliteracy-seal / tamil-diploma vocabulary
  teacher_id UUID REFERENCES sms_teachers(id) ON DELETE SET NULL,
  schedule_day TEXT,
  start_time TEXT,
  end_time TEXT,
  room TEXT,
  academic_year TEXT NOT NULL DEFAULT '2026-2027',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SMS_CLASS_ENROLLMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_class_enrollments (
  class_id UUID NOT NULL REFERENCES sms_classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dropped')),
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (class_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_classes_teacher_id ON sms_classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_sms_class_enrollments_class ON sms_class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_sms_class_enrollments_student ON sms_class_enrollments(student_id);

DROP TRIGGER IF EXISTS trg_sms_classes_updated_at ON sms_classes;
CREATE TRIGGER trg_sms_classes_updated_at BEFORE UPDATE ON sms_classes
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE sms_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_class_enrollments ENABLE ROW LEVEL SECURITY;

-- --- sms_classes ---
CREATE POLICY "classes: admin all" ON sms_classes
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "classes: teacher read own" ON sms_classes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_teachers t WHERE t.id = sms_classes.teacher_id AND t.profile_id = auth.uid())
  );

CREATE POLICY "classes: student read enrolled" ON sms_classes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_class_enrollments ce
      JOIN sms_students s ON s.id = ce.student_id
      WHERE ce.class_id = sms_classes.id AND s.profile_id = auth.uid()
    )
  );

CREATE POLICY "classes: parent read child classes" ON sms_classes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_class_enrollments ce
      JOIN sms_student_parents sp ON sp.student_id = ce.student_id
      JOIN sms_parents p ON p.id = sp.parent_id
      WHERE ce.class_id = sms_classes.id AND p.profile_id = auth.uid()
    )
  );

-- --- sms_class_enrollments ---
CREATE POLICY "enrollments: admin all" ON sms_class_enrollments
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "enrollments: teacher read own class rosters" ON sms_class_enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_classes c
      JOIN sms_teachers t ON t.id = c.teacher_id
      WHERE c.id = sms_class_enrollments.class_id AND t.profile_id = auth.uid()
    )
  );

CREATE POLICY "enrollments: student read own" ON sms_class_enrollments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_class_enrollments.student_id AND s.profile_id = auth.uid())
  );

CREATE POLICY "enrollments: parent read child" ON sms_class_enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_student_parents sp
      JOIN sms_parents p ON p.id = sp.parent_id
      WHERE sp.student_id = sms_class_enrollments.student_id AND p.profile_id = auth.uid()
    )
  );

-- =====================================================
-- UPDATE new-user trigger to also copy email
-- =====================================================
CREATE OR REPLACE FUNCTION sms_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO sms_profiles (id, role, first_name, last_name, email)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::sms_role, 'student'),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

-- =====================================================
-- BACKFILL: Phase 1 test profiles were created before the
-- email column existed. One-time sync from auth.users.
-- =====================================================
UPDATE sms_profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;
