-- =====================================================
-- HSCF SCHOOL MANAGEMENT SYSTEM - TEACHER PORTAL (Phase 3)
-- =====================================================
-- Adds sms_attendance, sms_assignments, sms_grades,
-- sms_announcements (+ sms_announcement_classes).
-- Also TIGHTENS the Phase 1 "teacher read" policies on
-- sms_students and sms_parents, which previously let any
-- teacher read every student/parent -- Phase 3 explicitly
-- requires teachers be scoped to only their assigned
-- students. Does not touch any website_* or Tamizhi table.
-- =====================================================

-- =====================================================
-- SECURITY FIX: "profiles: update own" (Phase 1) allows a
-- row-level update to any column on your own profile,
-- including role and is_active -- RLS alone doesn't restrict
-- to specific columns. A teacher could self-promote to admin
-- via a raw API call. Column-level privileges close this:
-- the 'authenticated' Postgres role (anon-key sessions) can
-- no longer UPDATE role/is_active/email at all, regardless of
-- what any policy allows. Admin's own privileged updates to
-- these columns already go through the service-role client
-- (bypasses grants entirely), so this doesn't break Phase 2.
-- =====================================================
REVOKE UPDATE (role, is_active, email) ON sms_profiles FROM authenticated;

-- =====================================================
-- HELPER: does the current user teach this student
-- (via any class the student is enrolled in)? SECURITY
-- DEFINER so it bypasses RLS internally, same pattern used
-- to fix the sms_classes/sms_class_enrollments recursion.
-- =====================================================
CREATE OR REPLACE FUNCTION sms_teacher_teaches_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_class_enrollments ce
    JOIN sms_classes c ON c.id = ce.class_id
    JOIN sms_teachers t ON t.id = c.teacher_id
    WHERE ce.student_id = p_student_id AND t.profile_id = auth.uid()
  );
$$;

-- =====================================================
-- TIGHTEN: teacher read access to students/parents is now
-- scoped to only students enrolled in one of the teacher's
-- own classes (and those students' parents).
-- =====================================================
DROP POLICY IF EXISTS "students: teacher read" ON sms_students;
CREATE POLICY "students: teacher read own" ON sms_students
  FOR SELECT USING (sms_teacher_teaches_student(id));

DROP POLICY IF EXISTS "parents: teacher read" ON sms_parents;
CREATE POLICY "parents: teacher read own students parents" ON sms_parents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_student_parents sp
      WHERE sp.parent_id = sms_parents.id AND sms_teacher_teaches_student(sp.student_id)
    )
  );

-- =====================================================
-- SMS_ATTENDANCE
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES sms_classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  notes TEXT,
  marked_by UUID REFERENCES sms_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (class_id, student_id, date)
);

CREATE INDEX IF NOT EXISTS idx_sms_attendance_class_date ON sms_attendance(class_id, date);
CREATE INDEX IF NOT EXISTS idx_sms_attendance_student ON sms_attendance(student_id);

DROP TRIGGER IF EXISTS trg_sms_attendance_updated_at ON sms_attendance;
CREATE TRIGGER trg_sms_attendance_updated_at BEFORE UPDATE ON sms_attendance
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();

ALTER TABLE sms_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance: admin all" ON sms_attendance
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "attendance: teacher manage own class" ON sms_attendance
  FOR ALL USING (sms_teacher_owns_class(class_id));

CREATE POLICY "attendance: student read own" ON sms_attendance
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_attendance.student_id AND s.profile_id = auth.uid())
  );

CREATE POLICY "attendance: parent read child" ON sms_attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_student_parents sp
      JOIN sms_parents p ON p.id = sp.parent_id
      WHERE sp.student_id = sms_attendance.student_id AND p.profile_id = auth.uid()
    )
  );

-- =====================================================
-- SMS_ASSIGNMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES sms_classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  max_score NUMERIC NOT NULL DEFAULT 100,
  published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES sms_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_assignments_class ON sms_assignments(class_id);

DROP TRIGGER IF EXISTS trg_sms_assignments_updated_at ON sms_assignments;
CREATE TRIGGER trg_sms_assignments_updated_at BEFORE UPDATE ON sms_assignments
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();

ALTER TABLE sms_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignments: admin all" ON sms_assignments
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "assignments: teacher manage own class" ON sms_assignments
  FOR ALL USING (sms_teacher_owns_class(class_id));

CREATE POLICY "assignments: student read published in own class" ON sms_assignments
  FOR SELECT USING (
    published AND EXISTS (
      SELECT 1 FROM sms_class_enrollments ce
      JOIN sms_students s ON s.id = ce.student_id
      WHERE ce.class_id = sms_assignments.class_id AND s.profile_id = auth.uid()
    )
  );

CREATE POLICY "assignments: parent read published for child" ON sms_assignments
  FOR SELECT USING (
    published AND EXISTS (
      SELECT 1 FROM sms_class_enrollments ce
      JOIN sms_student_parents sp ON sp.student_id = ce.student_id
      JOIN sms_parents p ON p.id = sp.parent_id
      WHERE ce.class_id = sms_assignments.class_id AND p.profile_id = auth.uid()
    )
  );

-- =====================================================
-- SMS_GRADES
-- Rows are created on demand when a teacher grades a
-- student (not pre-populated at assignment creation) --
-- the gradebook UI shows every enrolled student regardless
-- via a LEFT JOIN, so "automatic receipt" of an assignment
-- doesn't depend on a row existing here yet.
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES sms_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  score NUMERIC,
  feedback TEXT,
  graded_by UUID REFERENCES sms_profiles(id),
  graded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_grades_assignment ON sms_grades(assignment_id);
CREATE INDEX IF NOT EXISTS idx_sms_grades_student ON sms_grades(student_id);

DROP TRIGGER IF EXISTS trg_sms_grades_updated_at ON sms_grades;
CREATE TRIGGER trg_sms_grades_updated_at BEFORE UPDATE ON sms_grades
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();

ALTER TABLE sms_grades ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION sms_teacher_owns_assignment(p_assignment_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_assignments a
    WHERE a.id = p_assignment_id AND sms_teacher_owns_class(a.class_id)
  );
$$;

CREATE POLICY "grades: admin all" ON sms_grades
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "grades: teacher manage own assignment" ON sms_grades
  FOR ALL USING (sms_teacher_owns_assignment(assignment_id));

CREATE POLICY "grades: student read own" ON sms_grades
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_grades.student_id AND s.profile_id = auth.uid())
  );

CREATE POLICY "grades: parent read child" ON sms_grades
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_student_parents sp
      JOIN sms_parents p ON p.id = sp.parent_id
      WHERE sp.student_id = sms_grades.student_id AND p.profile_id = auth.uid()
    )
  );

-- =====================================================
-- SMS_ANNOUNCEMENTS (+ sms_announcement_classes)
-- grade_level set -> broadcasts to every class of that
-- grade. Otherwise visibility is via explicit class targets
-- in sms_announcement_classes (one row per targeted class;
-- "individual class" and "multiple classes" are the same
-- mechanism with 1 vs many rows).
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  grade_level TEXT,
  created_by UUID REFERENCES sms_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sms_announcement_classes (
  announcement_id UUID NOT NULL REFERENCES sms_announcements(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES sms_classes(id) ON DELETE CASCADE,
  PRIMARY KEY (announcement_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_announcement_classes_class ON sms_announcement_classes(class_id);

DROP TRIGGER IF EXISTS trg_sms_announcements_updated_at ON sms_announcements;
CREATE TRIGGER trg_sms_announcements_updated_at BEFORE UPDATE ON sms_announcements
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();

ALTER TABLE sms_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_announcement_classes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION sms_announcement_targets_teacher(p_announcement_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_announcement_classes ac
    JOIN sms_classes c ON c.id = ac.class_id
    JOIN sms_teachers t ON t.id = c.teacher_id
    WHERE ac.announcement_id = p_announcement_id AND t.profile_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM sms_announcements a
    JOIN sms_classes c ON c.grade_level = a.grade_level
    JOIN sms_teachers t ON t.id = c.teacher_id
    WHERE a.id = p_announcement_id AND a.grade_level IS NOT NULL AND t.profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION sms_announcement_targets_student(p_announcement_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_announcement_classes ac
    JOIN sms_class_enrollments ce ON ce.class_id = ac.class_id
    JOIN sms_students s ON s.id = ce.student_id
    WHERE ac.announcement_id = p_announcement_id AND s.profile_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM sms_announcements a
    JOIN sms_classes c ON c.grade_level = a.grade_level
    JOIN sms_class_enrollments ce ON ce.class_id = c.id
    JOIN sms_students s ON s.id = ce.student_id
    WHERE a.id = p_announcement_id AND a.grade_level IS NOT NULL AND s.profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION sms_announcement_targets_parent(p_announcement_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_announcement_classes ac
    JOIN sms_class_enrollments ce ON ce.class_id = ac.class_id
    JOIN sms_student_parents sp ON sp.student_id = ce.student_id
    JOIN sms_parents p ON p.id = sp.parent_id
    WHERE ac.announcement_id = p_announcement_id AND p.profile_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM sms_announcements a
    JOIN sms_classes c ON c.grade_level = a.grade_level
    JOIN sms_class_enrollments ce ON ce.class_id = c.id
    JOIN sms_student_parents sp ON sp.student_id = ce.student_id
    JOIN sms_parents p ON p.id = sp.parent_id
    WHERE a.id = p_announcement_id AND a.grade_level IS NOT NULL AND p.profile_id = auth.uid()
  );
$$;

CREATE POLICY "announcements: admin all" ON sms_announcements
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "announcements: creator manage own" ON sms_announcements
  FOR ALL USING (created_by = auth.uid());

CREATE POLICY "announcements: teacher read targeted" ON sms_announcements
  FOR SELECT USING (sms_announcement_targets_teacher(id));

CREATE POLICY "announcements: student read targeted" ON sms_announcements
  FOR SELECT USING (sms_announcement_targets_student(id));

CREATE POLICY "announcements: parent read targeted" ON sms_announcements
  FOR SELECT USING (sms_announcement_targets_parent(id));

CREATE POLICY "announcement_classes: admin all" ON sms_announcement_classes
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "announcement_classes: creator manage own" ON sms_announcement_classes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sms_announcements a WHERE a.id = sms_announcement_classes.announcement_id AND a.created_by = auth.uid())
  );

CREATE POLICY "announcement_classes: readable if announcement readable" ON sms_announcement_classes
  FOR SELECT USING (
    sms_announcement_targets_teacher(announcement_id)
    OR sms_announcement_targets_student(announcement_id)
    OR sms_announcement_targets_parent(announcement_id)
  );
