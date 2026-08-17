-- =====================================================
-- 042: FIX REMAINING single-teacher_id CHECKS 036 MISSED
--
-- 036 repointed sms_teacher_owns_class() to check sms_class_teachers
-- membership instead of sms_classes.teacher_id directly, and its comment
-- claimed that covered "the assignments, attendance, enrollments, grades
-- and join-request policies" since they all route through that one
-- helper. True for policies that call the helper -- but five OTHER
-- functions independently inlined the exact same
-- `JOIN sms_teachers t ON t.id = c.teacher_id` pattern instead of calling
-- it, so 036 never touched them. A co-teacher (approved, present in
-- sms_class_teachers, shown correctly in every UI) is still invisible to
-- all five:
--
--   sms_teacher_has_pending_join_request_from (023) -- lets a teacher see
--     a requesting student's name on the Pending Join Requests list.
--     A co-teacher's embed comes back NULL and the page crashes on
--     `.first_name` -- this is the bug actually reported.
--   sms_teacher_teaches_student (004/014) -- "students: teacher read
--     own" and the matching sms_parents policy. Would have crashed the
--     roster/parent views next, once a co-teacher has enrolled students.
--   sms_announcement_visible_to_teacher (012/014) -- grade- and
--     class-targeted announcements invisible to a co-teacher.
--   sms_can_chat (017) -- a co-teacher can't message their co-taught
--     class's students or those students' parents.
--   sms_notify_on_join_request (032) -- only the lead teacher gets
--     notified of a new join request, not co-teachers.
--
-- The first three are rewritten to call sms_teacher_owns_class(), same
-- as everything 036 already covers -- one source of truth going forward.
-- sms_can_chat operates on two arbitrary profile ids, not "the current
-- caller", so it can't call that (current-user-scoped) helper directly;
-- its join is swapped from sms_classes to sms_class_teachers instead,
-- same underlying fix. sms_notify_on_join_request now loops over every
-- co-teacher instead of assuming exactly one.
-- =====================================================

CREATE OR REPLACE FUNCTION sms_teacher_has_pending_join_request_from(p_student_id UUID)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_class_join_requests jr
    WHERE jr.student_id = p_student_id AND sms_teacher_owns_class(jr.class_id)
  );
$$;

CREATE OR REPLACE FUNCTION sms_teacher_teaches_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_class_enrollments ce
    WHERE ce.student_id = p_student_id AND sms_teacher_owns_class(ce.class_id)
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
              SELECT 1 FROM sms_classes c
              WHERE c.grade_level = a.grade_level AND sms_teacher_owns_class(c.id)
            ))
        OR (a.audience_type = 'class' AND EXISTS (
              SELECT 1 FROM sms_announcement_classes ac
              WHERE ac.announcement_id = a.id AND sms_teacher_owns_class(ac.class_id)
            ))
      )
  );
$$;

CREATE OR REPLACE FUNCTION sms_can_chat(a TEXT, b TEXT)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM sms_profiles WHERE id IN (a, b) AND role = 'admin')
    OR (
      (SELECT role FROM sms_profiles WHERE id = a) = 'teacher'
      AND (SELECT role FROM sms_profiles WHERE id = b) = 'teacher'
    )
    OR EXISTS (
      SELECT 1 FROM sms_class_enrollments ce
      JOIN sms_class_teachers ct ON ct.class_id = ce.class_id
      JOIN sms_teachers t ON t.id = ct.teacher_id
      JOIN sms_students s ON s.id = ce.student_id
      WHERE (t.profile_id = a AND s.profile_id = b)
         OR (t.profile_id = b AND s.profile_id = a)
    )
    OR EXISTS (
      SELECT 1 FROM sms_class_enrollments ce
      JOIN sms_class_teachers ct ON ct.class_id = ce.class_id
      JOIN sms_teachers t ON t.id = ct.teacher_id
      JOIN sms_student_parents sp ON sp.student_id = ce.student_id
      JOIN sms_parents p ON p.id = sp.parent_id
      WHERE (t.profile_id = a AND p.profile_id = b)
         OR (t.profile_id = b AND p.profile_id = a)
    )
    OR EXISTS (
      SELECT 1 FROM sms_student_parents sp
      JOIN sms_students s ON s.id = sp.student_id
      JOIN sms_parents p ON p.id = sp.parent_id
      WHERE (s.profile_id = a AND p.profile_id = b)
         OR (s.profile_id = b AND p.profile_id = a)
    );
$$;

CREATE OR REPLACE FUNCTION sms_notify_on_join_request()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student TEXT;
  v_class TEXT;
  v_teacher_profile TEXT;
BEGIN
  SELECT TRIM(first_name || ' ' || last_name) INTO v_student
  FROM sms_students WHERE id = NEW.student_id;

  SELECT name INTO v_class FROM sms_classes WHERE id = NEW.class_id;

  FOR v_teacher_profile IN
    SELECT t.profile_id
    FROM sms_class_teachers ct
    JOIN sms_teachers t ON t.id = ct.teacher_id
    WHERE ct.class_id = NEW.class_id
  LOOP
    PERFORM sms_notify(
      v_teacher_profile,
      'join_request',
      COALESCE(v_student, 'A student') || ' asked to join ' || COALESCE(v_class, 'your class'),
      'Waiting for approval',
      '/classes/' || NEW.class_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;
