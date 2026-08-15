-- =====================================================
-- 038: PERMANENT DELETE FOR TEACHERS AND STUDENTS
--
-- 037 made "Delete" a soft-delete (deleted_at + is_active=false),
-- restorable, keeping every historical record. That's the everyday
-- "Delete" button. This adds a second, separate, much more dangerous
-- action -- "Permanently Delete", only reachable from the Deleted tab --
-- that genuinely removes the person and their data from the system.
--
-- Students also get the same soft-delete shape teachers already have
-- (deleted_at, restorable), which they had none of before this.
-- =====================================================

ALTER TABLE sms_students ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- -----------------------------------------------------
-- sms_purge_profile: permanently remove a teacher (or any profile-
-- identified person with a login).
--
-- sms_attendance.marked_by, sms_assignments.created_by,
-- sms_grades.graded_by, sms_announcements.created_by,
-- sms_conversations.created_by, sms_student_payments.marked_by,
-- sms_class_teachers.assigned_by, sms_role_grants.granted_by and
-- sms_class_promotions.promoted_by/undone_by all reference sms_profiles
-- with NO ACTION and no CASCADE -- they're attribution on OTHER
-- people's data (a student's attendance mark, another admin's payment
-- record), not this person's own data, so purging detaches the
-- reference instead of deleting the row it's attached to.
--
-- sms_messages.sender_id is NOT NULL with no CASCADE, so a message this
-- person sent can't be detached -- it's deleted outright, which is the
-- content genuinely theirs (a 1:1 conversation with them cascades away
-- entirely via user_a/user_b's own ON DELETE CASCADE; a group message
-- doesn't take the conversation down, hence the explicit delete here).
--
-- sms_students.profile_id is ON DELETE SET NULL, not CASCADE (by
-- design -- academic history is meant to survive a login being merely
-- removed). A purge means the opposite of that, so this explicitly
-- deletes the sms_students row too, which cascades to enrollments,
-- attendance, submissions, grades, parent link requests, class join
-- requests, promotions and payments for that student.
--
-- The final sms_profiles delete cascades to sms_teachers/sms_parents
-- (and, transitively, class-teacher membership/requests), chat
-- conversations/participants, notifications, and role grants where
-- this profile is the grantee.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION sms_purge_profile(p_profile_id TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sms_attendance SET marked_by = NULL WHERE marked_by = p_profile_id;
  UPDATE sms_assignments SET created_by = NULL WHERE created_by = p_profile_id;
  UPDATE sms_grades SET graded_by = NULL WHERE graded_by = p_profile_id;
  UPDATE sms_announcements SET created_by = NULL WHERE created_by = p_profile_id;
  UPDATE sms_conversations SET created_by = NULL WHERE created_by = p_profile_id;
  UPDATE sms_student_payments SET marked_by = NULL WHERE marked_by = p_profile_id;
  UPDATE sms_class_teachers SET assigned_by = NULL WHERE assigned_by = p_profile_id;
  UPDATE sms_role_grants SET granted_by = NULL WHERE granted_by = p_profile_id;
  UPDATE sms_class_promotions SET promoted_by = NULL WHERE promoted_by = p_profile_id;
  UPDATE sms_class_promotions SET undone_by = NULL WHERE undone_by = p_profile_id;

  DELETE FROM sms_messages WHERE sender_id = p_profile_id;
  DELETE FROM sms_students WHERE profile_id = p_profile_id;
  DELETE FROM sms_profiles WHERE id = p_profile_id;
END;
$$;

-- -----------------------------------------------------
-- sms_purge_student: permanently remove a student. Keyed on
-- sms_students.id rather than profile id -- a student created without
-- a login has no profile row at all, so purging must work either way.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION sms_purge_student(p_student_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id TEXT;
BEGIN
  SELECT profile_id INTO v_profile_id FROM sms_students WHERE id = p_student_id;

  -- Cascades to enrollments, attendance, submissions, grades, parent
  -- link requests, class join requests, promotions and payments.
  DELETE FROM sms_students WHERE id = p_student_id;

  IF v_profile_id IS NOT NULL THEN
    DELETE FROM sms_messages WHERE sender_id = v_profile_id;
    DELETE FROM sms_profiles WHERE id = v_profile_id;
  END IF;
END;
$$;
