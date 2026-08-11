-- =====================================================
-- HSCF SCHOOL MANAGEMENT SYSTEM - CORE SCHEMA (Phase 1)
-- =====================================================
-- Runs in the SAME Supabase project as the marketing website
-- and the Tamizhi app. All tables are prefixed sms_ to avoid
-- any collision with website_* or Tamizhi tables.
--
-- This migration does NOT touch any existing table.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ROLE ENUM
-- =====================================================
DO $$ BEGIN
  CREATE TYPE sms_role AS ENUM ('admin', 'teacher', 'student', 'parent');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- SMS_PROFILES
-- One row per authenticated user (1:1 with auth.users),
-- created automatically via trigger on signup/invite.
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role sms_role NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SMS_TEACHERS
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL UNIQUE REFERENCES sms_profiles(id) ON DELETE CASCADE,
  subject_specialty TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SMS_STUDENTS
-- profile_id is nullable: a student row can exist before
-- the student has their own login (e.g. young children whose
-- parent manages everything), and is linked once invited.
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID UNIQUE REFERENCES sms_profiles(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  grade_level TEXT, -- reuses the Nilai 1-8 / biliteracy-seal / tamil-diploma vocabulary from the marketing site
  enrollment_status TEXT NOT NULL DEFAULT 'active' CHECK (enrollment_status IN ('active', 'inactive', 'graduated', 'withdrawn')),
  academic_year TEXT NOT NULL DEFAULT '2026-2027',
  source_registration_id UUID, -- optional link back to website_registrations.id (read-only reference, no FK across projects/schemas boundary concerns)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SMS_PARENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_parents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL UNIQUE REFERENCES sms_profiles(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SMS_STUDENT_PARENTS (many-to-many: siblings share parents)
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_student_parents (
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES sms_parents(id) ON DELETE CASCADE,
  relationship TEXT DEFAULT 'parent/guardian',
  PRIMARY KEY (student_id, parent_id)
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_sms_teachers_profile_id ON sms_teachers(profile_id);
CREATE INDEX IF NOT EXISTS idx_sms_students_profile_id ON sms_students(profile_id);
CREATE INDEX IF NOT EXISTS idx_sms_parents_profile_id ON sms_parents(profile_id);
CREATE INDEX IF NOT EXISTS idx_sms_student_parents_student ON sms_student_parents(student_id);
CREATE INDEX IF NOT EXISTS idx_sms_student_parents_parent ON sms_student_parents(parent_id);

-- =====================================================
-- updated_at TRIGGER (reuses same convention as website tables)
-- =====================================================
CREATE OR REPLACE FUNCTION sms_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sms_profiles_updated_at ON sms_profiles;
CREATE TRIGGER trg_sms_profiles_updated_at BEFORE UPDATE ON sms_profiles
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();

DROP TRIGGER IF EXISTS trg_sms_teachers_updated_at ON sms_teachers;
CREATE TRIGGER trg_sms_teachers_updated_at BEFORE UPDATE ON sms_teachers
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();

DROP TRIGGER IF EXISTS trg_sms_students_updated_at ON sms_students;
CREATE TRIGGER trg_sms_students_updated_at BEFORE UPDATE ON sms_students
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();

DROP TRIGGER IF EXISTS trg_sms_parents_updated_at ON sms_parents;
CREATE TRIGGER trg_sms_parents_updated_at BEFORE UPDATE ON sms_parents
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE sms_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_student_parents ENABLE ROW LEVEL SECURITY;

-- Helper: current user's role, used inside policies below
CREATE OR REPLACE FUNCTION sms_current_role()
RETURNS sms_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM sms_profiles WHERE id = auth.uid();
$$;

-- --- sms_profiles ---
-- Everyone can read their own profile
CREATE POLICY "profiles: read own" ON sms_profiles
  FOR SELECT USING (id = auth.uid());

-- Admins can read/manage all profiles
CREATE POLICY "profiles: admin read all" ON sms_profiles
  FOR SELECT USING (sms_current_role() = 'admin');

CREATE POLICY "profiles: admin update all" ON sms_profiles
  FOR UPDATE USING (sms_current_role() = 'admin');

-- Users can update their own basic info (not role)
CREATE POLICY "profiles: update own" ON sms_profiles
  FOR UPDATE USING (id = auth.uid());

-- --- sms_teachers ---
CREATE POLICY "teachers: self read" ON sms_teachers
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "teachers: admin all" ON sms_teachers
  FOR ALL USING (sms_current_role() = 'admin');

-- Any authenticated user can view the teacher directory (names/specialty are not sensitive)
CREATE POLICY "teachers: authenticated read" ON sms_teachers
  FOR SELECT USING (auth.role() = 'authenticated');

-- --- sms_students ---
CREATE POLICY "students: self read" ON sms_students
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "students: admin all" ON sms_students
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "students: teacher read" ON sms_students
  FOR SELECT USING (sms_current_role() = 'teacher');

CREATE POLICY "students: parent read own children" ON sms_students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_student_parents sp
      JOIN sms_parents p ON p.id = sp.parent_id
      WHERE sp.student_id = sms_students.id AND p.profile_id = auth.uid()
    )
  );

-- --- sms_parents ---
CREATE POLICY "parents: self read" ON sms_parents
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "parents: admin all" ON sms_parents
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "parents: teacher read" ON sms_parents
  FOR SELECT USING (sms_current_role() = 'teacher');

-- --- sms_student_parents ---
CREATE POLICY "student_parents: admin all" ON sms_student_parents
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "student_parents: parent read own links" ON sms_student_parents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_parents p WHERE p.id = sms_student_parents.parent_id AND p.profile_id = auth.uid()
    )
  );

CREATE POLICY "student_parents: teacher read" ON sms_student_parents
  FOR SELECT USING (sms_current_role() = 'teacher');

-- =====================================================
-- AUTO-CREATE PROFILE ON NEW AUTH USER
-- Reads role/first_name/last_name out of the invite's
-- user_metadata (set server-side by the admin invite API).
-- =====================================================
CREATE OR REPLACE FUNCTION sms_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO sms_profiles (id, role, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::sms_role, 'student'),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_handle_new_user ON auth.users;
CREATE TRIGGER trg_sms_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sms_handle_new_user();
