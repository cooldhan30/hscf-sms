-- =====================================================
-- 041: RE-APPLY 036 (MULTIPLE TEACHERS PER CLASS)
--
-- Production's database was found missing sms_role_grants (031) despite
-- that migration file existing in the repo and being marked applied --
-- migrations here have apparently not always fully landed. A co-teacher
-- (approved, present in sms_class_teachers, showing correctly in the
-- admin/roster UI) was unable to create assignments, mark attendance,
-- grade, post announcements, or approve student join requests for their
-- own class -- exactly what sms_teacher_owns_class() gates, and exactly
-- what 036 changed it to check (class_teachers membership) instead of
-- the old single sms_classes.teacher_id column.
--
-- Every statement in 036 is idempotent (CREATE OR REPLACE, IF NOT
-- EXISTS, ON CONFLICT DO NOTHING) -- this file re-runs it verbatim as a
-- safety net, rather than trying to prove exactly which part of it
-- didn't take the first time. A no-op if 036 already fully applied; the
-- actual fix if it didn't.
-- =====================================================

CREATE TABLE IF NOT EXISTS sms_class_teachers (
  class_id UUID NOT NULL REFERENCES sms_classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES sms_teachers(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  assigned_by TEXT REFERENCES sms_profiles(id),
  PRIMARY KEY (class_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_class_teachers_teacher ON sms_class_teachers(teacher_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_class_teachers_one_primary
  ON sms_class_teachers(class_id) WHERE is_primary;

INSERT INTO sms_class_teachers (class_id, teacher_id, is_primary)
SELECT id, teacher_id, true FROM sms_classes WHERE teacher_id IS NOT NULL
ON CONFLICT (class_id, teacher_id) DO NOTHING;

CREATE OR REPLACE FUNCTION sms_sync_primary_class_teacher()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.teacher_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE sms_class_teachers
  SET is_primary = false
  WHERE class_id = NEW.id AND teacher_id <> NEW.teacher_id AND is_primary;

  INSERT INTO sms_class_teachers (class_id, teacher_id, is_primary)
  VALUES (NEW.id, NEW.teacher_id, true)
  ON CONFLICT (class_id, teacher_id) DO UPDATE SET is_primary = true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_classes_sync_primary_teacher ON sms_classes;
CREATE TRIGGER trg_sms_classes_sync_primary_teacher
  AFTER INSERT OR UPDATE OF teacher_id ON sms_classes
  FOR EACH ROW EXECUTE FUNCTION sms_sync_primary_class_teacher();

-- THE key fix: repoint the one helper every teacher policy (assignments,
-- attendance, enrollments, grades, join-requests, classes-read) routes
-- through, from checking sms_classes.teacher_id directly to checking
-- sms_class_teachers membership.
CREATE OR REPLACE FUNCTION sms_teacher_owns_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM sms_class_teachers ct
    JOIN sms_teachers t ON t.id = ct.teacher_id
    WHERE ct.class_id = p_class_id AND t.profile_id = sms_current_user_id()
  );
$$;

DROP POLICY IF EXISTS "classes: teacher read own" ON sms_classes;
CREATE POLICY "classes: teacher read own" ON sms_classes
  FOR SELECT USING (sms_teacher_owns_class(id));

CREATE OR REPLACE FUNCTION sms_class_teacher_requests_apply_approval()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    INSERT INTO sms_class_teachers (class_id, teacher_id)
    VALUES (NEW.class_id, NEW.teacher_id)
    ON CONFLICT (class_id, teacher_id) DO NOTHING;

    UPDATE sms_classes
    SET teacher_id = NEW.teacher_id
    WHERE id = NEW.class_id AND teacher_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE sms_class_teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_teachers: admin all" ON sms_class_teachers;
CREATE POLICY "class_teachers: admin all" ON sms_class_teachers
  FOR ALL USING (sms_current_role() = 'admin');

DROP POLICY IF EXISTS "class_teachers: authenticated read" ON sms_class_teachers;
CREATE POLICY "class_teachers: authenticated read" ON sms_class_teachers
  FOR SELECT USING (sms_current_user_id() IS NOT NULL);
