-- =====================================================
-- 036: MULTIPLE TEACHERS PER CLASS
--
-- sms_classes.teacher_id allowed exactly one teacher, and approving a
-- second teacher's request OVERWROTE the first (022). Classes here are
-- co-taught, so assignment needs to be many-to-many.
--
-- Same shape as 031's multi-role change, for the same reason: rather
-- than rewriting every policy that asks "does this teacher own this
-- class", add a membership table and redirect the ONE helper function
-- that all of them already route through. sms_teacher_owns_class() is
-- used by the assignments, attendance, enrollments, grades and
-- join-request policies -- repointing it covers all of them at once.
--
-- sms_classes.teacher_id is kept, narrowed to mean "the primary/lead
-- teacher". Every existing query that embeds teacher:sms_teachers(...)
-- for display keeps working untouched, and there is still a single
-- obvious name to show next to a class.
-- =====================================================

-- -----------------------------------------------------
-- 1. Membership
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS sms_class_teachers (
  class_id UUID NOT NULL REFERENCES sms_classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES sms_teachers(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  assigned_by TEXT REFERENCES sms_profiles(id),
  PRIMARY KEY (class_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_class_teachers_teacher ON sms_class_teachers(teacher_id);

-- At most one lead teacher per class, so sms_classes.teacher_id always
-- has an unambiguous answer to mirror.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_class_teachers_one_primary
  ON sms_class_teachers(class_id) WHERE is_primary;

-- Backfill: whoever is currently assigned becomes the primary teacher.
INSERT INTO sms_class_teachers (class_id, teacher_id, is_primary)
SELECT id, teacher_id, true FROM sms_classes WHERE teacher_id IS NOT NULL
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- -----------------------------------------------------
-- 2. Keep the primary in step with sms_classes.teacher_id
--
-- AFTER, not BEFORE: a BEFORE INSERT trigger would try to reference a
-- class row that has not been written yet, which is exactly how 031's
-- equivalent trigger broke sign-up (see 034).
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION sms_sync_primary_class_teacher()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.teacher_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Demote first: the partial unique index permits only one primary, and
  -- the previous lead may still hold the flag while staying on as a
  -- co-teacher.
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

-- -----------------------------------------------------
-- 3. The one helper every teacher policy already uses
--
-- Repointing this at the membership table is what gives co-teachers
-- access to their class's assignments, attendance, roster and grades --
-- without touching any of those policies.
-- -----------------------------------------------------
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

-- -----------------------------------------------------
-- 4. The one policy that read teacher_id directly
--
-- Routed through the SECURITY DEFINER helper rather than querying
-- sms_class_teachers inline. An inline query would make a policy on
-- sms_classes depend on a table whose own policies can reference
-- sms_classes -- the recursion this schema has already had to fix three
-- times (003, 005, 021). SECURITY DEFINER bypasses RLS, breaking the
-- cycle.
-- -----------------------------------------------------
DROP POLICY IF EXISTS "classes: teacher read own" ON sms_classes;
CREATE POLICY "classes: teacher read own" ON sms_classes
  FOR SELECT USING (sms_teacher_owns_class(id));

-- -----------------------------------------------------
-- 5. Approving a teacher request ADDS a teacher
--
-- 022 overwrote sms_classes.teacher_id, so approving a second teacher
-- silently removed the first. Now it adds them to the class, and only
-- claims the lead slot if nobody holds it yet.
-- -----------------------------------------------------
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

    -- Only fills an empty lead slot; never displaces the existing one.
    UPDATE sms_classes
    SET teacher_id = NEW.teacher_id
    WHERE id = NEW.class_id AND teacher_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------
-- 6. Visibility
-- -----------------------------------------------------
ALTER TABLE sms_class_teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_teachers: admin all" ON sms_class_teachers;
CREATE POLICY "class_teachers: admin all" ON sms_class_teachers
  FOR ALL USING (sms_current_role() = 'admin');

-- Readable by any signed-in user. Who teaches which class is already
-- effectively public in this app -- the teacher directory is readable by
-- every authenticated user ("teachers: authenticated read"), and class
-- names are shown to enrolled students and their parents. Scoping this
-- per-class instead would need another SECURITY DEFINER helper for
-- "can you see this class", for no real gain.
DROP POLICY IF EXISTS "class_teachers: authenticated read" ON sms_class_teachers;
CREATE POLICY "class_teachers: authenticated read" ON sms_class_teachers
  FOR SELECT USING (sms_current_user_id() IS NOT NULL);
