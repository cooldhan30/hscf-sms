-- =====================================================
-- 039: MAKE PURGE TOLERANT OF MISSING OPTIONAL TABLES
--
-- 038's sms_purge_profile hard-failed with "relation sms_role_grants
-- does not exist" -- this production database never actually ran 031
-- (multi-role/role-switching), even though that migration file exists
-- in the repo, so several tables it and later migrations introduce
-- (sms_role_grants, sms_class_promotions, sms_student_payments,
-- sms_class_teachers, sms_conversations, sms_messages) may not exist
-- here yet. Since purging a teacher/student must still work regardless
-- of which optional features have actually been migrated, every
-- touched table is now existence-checked via to_regclass() first and
-- skipped if absent, instead of assumed present.
-- =====================================================

CREATE OR REPLACE FUNCTION sms_purge_profile(p_profile_id TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.sms_attendance') IS NOT NULL THEN
    UPDATE sms_attendance SET marked_by = NULL WHERE marked_by = p_profile_id;
  END IF;
  IF to_regclass('public.sms_assignments') IS NOT NULL THEN
    UPDATE sms_assignments SET created_by = NULL WHERE created_by = p_profile_id;
  END IF;
  IF to_regclass('public.sms_grades') IS NOT NULL THEN
    UPDATE sms_grades SET graded_by = NULL WHERE graded_by = p_profile_id;
  END IF;
  IF to_regclass('public.sms_announcements') IS NOT NULL THEN
    UPDATE sms_announcements SET created_by = NULL WHERE created_by = p_profile_id;
  END IF;
  IF to_regclass('public.sms_conversations') IS NOT NULL THEN
    UPDATE sms_conversations SET created_by = NULL WHERE created_by = p_profile_id;
  END IF;
  IF to_regclass('public.sms_student_payments') IS NOT NULL THEN
    UPDATE sms_student_payments SET marked_by = NULL WHERE marked_by = p_profile_id;
  END IF;
  IF to_regclass('public.sms_class_teachers') IS NOT NULL THEN
    UPDATE sms_class_teachers SET assigned_by = NULL WHERE assigned_by = p_profile_id;
  END IF;
  IF to_regclass('public.sms_role_grants') IS NOT NULL THEN
    UPDATE sms_role_grants SET granted_by = NULL WHERE granted_by = p_profile_id;
  END IF;
  IF to_regclass('public.sms_class_promotions') IS NOT NULL THEN
    UPDATE sms_class_promotions SET promoted_by = NULL WHERE promoted_by = p_profile_id;
    UPDATE sms_class_promotions SET undone_by = NULL WHERE undone_by = p_profile_id;
  END IF;
  IF to_regclass('public.sms_messages') IS NOT NULL THEN
    DELETE FROM sms_messages WHERE sender_id = p_profile_id;
  END IF;
  IF to_regclass('public.sms_students') IS NOT NULL THEN
    DELETE FROM sms_students WHERE profile_id = p_profile_id;
  END IF;

  DELETE FROM sms_profiles WHERE id = p_profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION sms_purge_student(p_student_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id TEXT;
BEGIN
  SELECT profile_id INTO v_profile_id FROM sms_students WHERE id = p_student_id;

  DELETE FROM sms_students WHERE id = p_student_id;

  IF v_profile_id IS NOT NULL THEN
    IF to_regclass('public.sms_messages') IS NOT NULL THEN
      DELETE FROM sms_messages WHERE sender_id = v_profile_id;
    END IF;
    DELETE FROM sms_profiles WHERE id = v_profile_id;
  END IF;
END;
$$;
