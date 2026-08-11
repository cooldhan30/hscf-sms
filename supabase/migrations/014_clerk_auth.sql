-- =====================================================
-- CLERK AUTH MIGRATION
-- =====================================================
-- Switches identity from Supabase Auth (auth.users) to Clerk,
-- fronted by Supabase's native Third-Party Auth support (see
-- Supabase dashboard: Authentication -> Third-Party Auth ->
-- Clerk). auth.uid() casts its result to ::uuid, but Clerk
-- user ids (e.g. "user_2abc...") are not UUIDs, so every RLS
-- policy/function that called auth.uid() is regenerated here
-- to call sms_current_user_id() instead, which reads the
-- Clerk id straight out of the JWT's `sub` claim as text. The
-- policy/function LOGIC is unchanged -- only the identity
-- source changed.
--
-- sms_profiles.id (and every column that FKs to it) moves
-- from UUID to TEXT accordingly, and the FK to auth.users is
-- dropped since auth.users is no longer the identity table.
-- Profile creation moves from the auth.users trigger to a
-- Clerk webhook (app/api/webhooks/clerk).
-- =====================================================

-- =====================================================
-- 1. New role: self-registered users awaiting admin approval
-- =====================================================
ALTER TYPE sms_role ADD VALUE IF NOT EXISTS 'pending';

-- =====================================================
-- 2. Identity helper: Clerk user id from the JWT `sub` claim
-- =====================================================
CREATE OR REPLACE FUNCTION sms_current_user_id()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT auth.jwt()->>'sub';
$$;

-- =====================================================
-- 3. Drop the auth.users-based profile-creation trigger
--    (replaced by the Clerk webhook)
-- =====================================================
DROP TRIGGER IF EXISTS trg_sms_handle_new_user ON auth.users;
DROP FUNCTION IF EXISTS sms_handle_new_user();

-- =====================================================
-- 3b. Postgres refuses to retype a column that a policy's
--     USING/CHECK expression references directly, so every
--     policy touching one of the columns below must be
--     dropped now and recreated in section 9 (after the
--     retype), not just regenerated in place.
-- =====================================================
DROP POLICY IF EXISTS "profiles: read own" ON sms_profiles;
DROP POLICY IF EXISTS "profiles: update own" ON sms_profiles;
DROP POLICY IF EXISTS "teachers: self read" ON sms_teachers;
DROP POLICY IF EXISTS "teachers: self update" ON sms_teachers;
DROP POLICY IF EXISTS "students: self read" ON sms_students;
DROP POLICY IF EXISTS "students: parent read own children" ON sms_students;
DROP POLICY IF EXISTS "parents: self read" ON sms_parents;
DROP POLICY IF EXISTS "parents: self update" ON sms_parents;
DROP POLICY IF EXISTS "student_parents: parent read own links" ON sms_student_parents;
DROP POLICY IF EXISTS "classes: teacher read own" ON sms_classes;
DROP POLICY IF EXISTS "enrollments: student read own" ON sms_class_enrollments;
DROP POLICY IF EXISTS "enrollments: parent read child" ON sms_class_enrollments;
DROP POLICY IF EXISTS "attendance: student read own" ON sms_attendance;
DROP POLICY IF EXISTS "attendance: parent read child" ON sms_attendance;
DROP POLICY IF EXISTS "assignments: student read published in own class" ON sms_assignments;
DROP POLICY IF EXISTS "assignments: parent read published for child" ON sms_assignments;
DROP POLICY IF EXISTS "grades: student read own" ON sms_grades;
DROP POLICY IF EXISTS "grades: parent read child" ON sms_grades;
DROP POLICY IF EXISTS "announcements: creator manage own" ON sms_announcements;
DROP POLICY IF EXISTS "announcement_classes: creator manage own" ON sms_announcement_classes;
DROP POLICY IF EXISTS "announcement_notifications: creator read own" ON sms_announcement_notifications;
DROP POLICY IF EXISTS "announcement_notifications: creator insert own" ON sms_announcement_notifications;

-- =====================================================
-- 4. Drop FKs that will be retyped
-- =====================================================
ALTER TABLE sms_profiles DROP CONSTRAINT IF EXISTS sms_profiles_id_fkey;
ALTER TABLE sms_teachers DROP CONSTRAINT IF EXISTS sms_teachers_profile_id_fkey;
ALTER TABLE sms_students DROP CONSTRAINT IF EXISTS sms_students_profile_id_fkey;
ALTER TABLE sms_parents DROP CONSTRAINT IF EXISTS sms_parents_profile_id_fkey;
ALTER TABLE sms_attendance DROP CONSTRAINT IF EXISTS sms_attendance_marked_by_fkey;
ALTER TABLE sms_assignments DROP CONSTRAINT IF EXISTS sms_assignments_created_by_fkey;
ALTER TABLE sms_grades DROP CONSTRAINT IF EXISTS sms_grades_graded_by_fkey;
ALTER TABLE sms_announcements DROP CONSTRAINT IF EXISTS sms_announcements_created_by_fkey;

-- =====================================================
-- 5. UUID -> TEXT on every column that stores/references a
--    profile id
-- =====================================================
ALTER TABLE sms_profiles ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE sms_teachers ALTER COLUMN profile_id TYPE TEXT USING profile_id::text;
ALTER TABLE sms_students ALTER COLUMN profile_id TYPE TEXT USING profile_id::text;
ALTER TABLE sms_parents ALTER COLUMN profile_id TYPE TEXT USING profile_id::text;
ALTER TABLE sms_attendance ALTER COLUMN marked_by TYPE TEXT USING marked_by::text;
ALTER TABLE sms_assignments ALTER COLUMN created_by TYPE TEXT USING created_by::text;
ALTER TABLE sms_grades ALTER COLUMN graded_by TYPE TEXT USING graded_by::text;
ALTER TABLE sms_announcements ALTER COLUMN created_by TYPE TEXT USING created_by::text;

-- =====================================================
-- 6. Recreate FKs (same ON DELETE behavior as before)
-- =====================================================
ALTER TABLE sms_teachers ADD CONSTRAINT sms_teachers_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES sms_profiles(id) ON DELETE CASCADE;
ALTER TABLE sms_students ADD CONSTRAINT sms_students_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES sms_profiles(id) ON DELETE SET NULL;
ALTER TABLE sms_parents ADD CONSTRAINT sms_parents_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES sms_profiles(id) ON DELETE CASCADE;
ALTER TABLE sms_attendance ADD CONSTRAINT sms_attendance_marked_by_fkey
  FOREIGN KEY (marked_by) REFERENCES sms_profiles(id);
ALTER TABLE sms_assignments ADD CONSTRAINT sms_assignments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES sms_profiles(id);
ALTER TABLE sms_grades ADD CONSTRAINT sms_grades_graded_by_fkey
  FOREIGN KEY (graded_by) REFERENCES sms_profiles(id);
ALTER TABLE sms_announcements ADD CONSTRAINT sms_announcements_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES sms_profiles(id);

-- =====================================================
-- 7. Regenerate sms_current_role() to key off the Clerk id
-- =====================================================
CREATE OR REPLACE FUNCTION sms_current_role()
RETURNS sms_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM sms_profiles WHERE id = sms_current_user_id();
$$;

-- =====================================================
-- 8. Regenerate every SECURITY DEFINER helper function that
--    called auth.uid() -- logic unchanged, identity source
--    swapped
-- =====================================================
CREATE OR REPLACE FUNCTION sms_teacher_owns_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_classes c
    JOIN sms_teachers t ON t.id = c.teacher_id
    WHERE c.id = p_class_id AND t.profile_id = sms_current_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION sms_user_enrolled_in_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_class_enrollments ce
    JOIN sms_students s ON s.id = ce.student_id
    WHERE ce.class_id = p_class_id AND s.profile_id = sms_current_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION sms_user_parent_of_class_student(p_class_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_class_enrollments ce
    JOIN sms_student_parents sp ON sp.student_id = ce.student_id
    JOIN sms_parents p ON p.id = sp.parent_id
    WHERE ce.class_id = p_class_id AND p.profile_id = sms_current_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION sms_teacher_teaches_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_class_enrollments ce
    JOIN sms_classes c ON c.id = ce.class_id
    JOIN sms_teachers t ON t.id = c.teacher_id
    WHERE ce.student_id = p_student_id AND t.profile_id = sms_current_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION sms_announcement_targets_teacher(p_announcement_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_announcement_classes ac
    JOIN sms_classes c ON c.id = ac.class_id
    JOIN sms_teachers t ON t.id = c.teacher_id
    WHERE ac.announcement_id = p_announcement_id AND t.profile_id = sms_current_user_id()
  ) OR EXISTS (
    SELECT 1 FROM sms_announcements a
    JOIN sms_classes c ON c.grade_level = a.grade_level
    JOIN sms_teachers t ON t.id = c.teacher_id
    WHERE a.id = p_announcement_id AND a.grade_level IS NOT NULL AND t.profile_id = sms_current_user_id()
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
    WHERE ac.announcement_id = p_announcement_id AND s.profile_id = sms_current_user_id()
  ) OR EXISTS (
    SELECT 1 FROM sms_announcements a
    JOIN sms_classes c ON c.grade_level = a.grade_level
    JOIN sms_class_enrollments ce ON ce.class_id = c.id
    JOIN sms_students s ON s.id = ce.student_id
    WHERE a.id = p_announcement_id AND a.grade_level IS NOT NULL AND s.profile_id = sms_current_user_id()
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
    WHERE ac.announcement_id = p_announcement_id AND p.profile_id = sms_current_user_id()
  ) OR EXISTS (
    SELECT 1 FROM sms_announcements a
    JOIN sms_classes c ON c.grade_level = a.grade_level
    JOIN sms_class_enrollments ce ON ce.class_id = c.id
    JOIN sms_student_parents sp ON sp.student_id = ce.student_id
    JOIN sms_parents p ON p.id = sp.parent_id
    WHERE a.id = p_announcement_id AND a.grade_level IS NOT NULL AND p.profile_id = sms_current_user_id()
  );
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
              WHERE c.grade_level = a.grade_level AND t.profile_id = sms_current_user_id()
            ))
        OR (a.audience_type = 'class' AND EXISTS (
              SELECT 1 FROM sms_announcement_classes ac
              JOIN sms_classes c ON c.id = ac.class_id
              JOIN sms_teachers t ON t.id = c.teacher_id
              WHERE ac.announcement_id = a.id AND t.profile_id = sms_current_user_id()
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
    JOIN sms_students s ON s.profile_id = sms_current_user_id()
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
    JOIN sms_parents p ON p.profile_id = sms_current_user_id()
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
-- 9. Regenerate every RLS policy that called auth.uid()
--    directly -- logic unchanged, identity source swapped
-- =====================================================
CREATE POLICY "profiles: read own" ON sms_profiles
  FOR SELECT USING (id = sms_current_user_id());

CREATE POLICY "profiles: update own" ON sms_profiles
  FOR UPDATE USING (id = sms_current_user_id());

CREATE POLICY "teachers: self read" ON sms_teachers
  FOR SELECT USING (profile_id = sms_current_user_id());

CREATE POLICY "teachers: self update" ON sms_teachers
  FOR UPDATE USING (profile_id = sms_current_user_id());

CREATE POLICY "students: self read" ON sms_students
  FOR SELECT USING (profile_id = sms_current_user_id());

CREATE POLICY "students: parent read own children" ON sms_students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_student_parents sp
      JOIN sms_parents p ON p.id = sp.parent_id
      WHERE sp.student_id = sms_students.id AND p.profile_id = sms_current_user_id()
    )
  );

CREATE POLICY "parents: self read" ON sms_parents
  FOR SELECT USING (profile_id = sms_current_user_id());

CREATE POLICY "parents: self update" ON sms_parents
  FOR UPDATE USING (profile_id = sms_current_user_id());

CREATE POLICY "student_parents: parent read own links" ON sms_student_parents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_parents p WHERE p.id = sms_student_parents.parent_id AND p.profile_id = sms_current_user_id()
    )
  );

CREATE POLICY "classes: teacher read own" ON sms_classes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_teachers t WHERE t.id = sms_classes.teacher_id AND t.profile_id = sms_current_user_id())
  );

CREATE POLICY "enrollments: student read own" ON sms_class_enrollments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_class_enrollments.student_id AND s.profile_id = sms_current_user_id())
  );

CREATE POLICY "enrollments: parent read child" ON sms_class_enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_student_parents sp
      JOIN sms_parents p ON p.id = sp.parent_id
      WHERE sp.student_id = sms_class_enrollments.student_id AND p.profile_id = sms_current_user_id()
    )
  );

CREATE POLICY "attendance: student read own" ON sms_attendance
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_attendance.student_id AND s.profile_id = sms_current_user_id())
  );

CREATE POLICY "attendance: parent read child" ON sms_attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_student_parents sp
      JOIN sms_parents p ON p.id = sp.parent_id
      WHERE sp.student_id = sms_attendance.student_id AND p.profile_id = sms_current_user_id()
    )
  );

CREATE POLICY "assignments: student read published in own class" ON sms_assignments
  FOR SELECT USING (
    published AND EXISTS (
      SELECT 1 FROM sms_class_enrollments ce
      JOIN sms_students s ON s.id = ce.student_id
      WHERE ce.class_id = sms_assignments.class_id AND s.profile_id = sms_current_user_id()
    )
  );

CREATE POLICY "assignments: parent read published for child" ON sms_assignments
  FOR SELECT USING (
    published AND EXISTS (
      SELECT 1 FROM sms_class_enrollments ce
      JOIN sms_student_parents sp ON sp.student_id = ce.student_id
      JOIN sms_parents p ON p.id = sp.parent_id
      WHERE ce.class_id = sms_assignments.class_id AND p.profile_id = sms_current_user_id()
    )
  );

CREATE POLICY "grades: student read own" ON sms_grades
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_grades.student_id AND s.profile_id = sms_current_user_id())
  );

CREATE POLICY "grades: parent read child" ON sms_grades
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_student_parents sp
      JOIN sms_parents p ON p.id = sp.parent_id
      WHERE sp.student_id = sms_grades.student_id AND p.profile_id = sms_current_user_id()
    )
  );

CREATE POLICY "announcements: creator manage own" ON sms_announcements
  FOR ALL USING (created_by = sms_current_user_id());

CREATE POLICY "announcement_classes: creator manage own" ON sms_announcement_classes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sms_announcements a WHERE a.id = sms_announcement_classes.announcement_id AND a.created_by = sms_current_user_id())
  );

CREATE POLICY "announcement_notifications: creator read own" ON sms_announcement_notifications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_announcements a WHERE a.id = sms_announcement_notifications.announcement_id AND a.created_by = sms_current_user_id())
  );

CREATE POLICY "announcement_notifications: creator insert own" ON sms_announcement_notifications
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM sms_announcements a WHERE a.id = sms_announcement_notifications.announcement_id AND a.created_by = sms_current_user_id())
  );

-- =====================================================
-- 10. Pending-role visibility: a pending user can read/update
--     their own profile (needed for the /pending-approval page
--     and so the webhook-created row is visible to its owner)
--     -- already covered by "profiles: read own"/"update own"
--     above, no new policy needed.
-- =====================================================
