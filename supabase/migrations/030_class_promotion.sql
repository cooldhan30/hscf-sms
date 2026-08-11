-- =====================================================
-- 030: COHORT PROMOTION (year rollover)
--
-- A class at this school is a cohort: the same group of students moves
-- up together year after year until they finish. So the rollover unit is
-- the CLASS, not the individual student -- an admin picks the source
-- class and the target class, and everyone active moves at once.
--
-- Done as a SECURITY DEFINER function rather than a sequence of API
-- calls because the move is not atomic otherwise: enrolling students in
-- the target, retiring the source enrollments, and restamping each
-- student's grade/year are three separate writes, and a failure between
-- them leaves a cohort half-promoted -- some students in two active
-- classes at once, others in none. In one function it is one
-- transaction: all of it, or none of it.
--
-- Every promotion is recorded with each student's PREVIOUS grade level
-- and academic year, so it can be undone exactly. An admin who promotes
-- the wrong class must be able to put it back.
-- =====================================================

-- -----------------------------------------------------
-- 1. Enrollments need a third state
--
-- A promoted student's source enrollment must stop counting as 'active'
-- (or they show up on two class rosters), but must not be 'dropped'
-- either -- that reads as leaving the school, and would corrupt the
-- historical record of who was in last year's class.
-- -----------------------------------------------------
ALTER TABLE sms_class_enrollments
  DROP CONSTRAINT IF EXISTS sms_class_enrollments_status_check;

ALTER TABLE sms_class_enrollments
  ADD CONSTRAINT sms_class_enrollments_status_check
  CHECK (status IN ('active', 'dropped', 'promoted'));

-- -----------------------------------------------------
-- 2. Audit trail
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS sms_class_promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_class_id UUID NOT NULL REFERENCES sms_classes(id) ON DELETE CASCADE,
  target_class_id UUID NOT NULL REFERENCES sms_classes(id) ON DELETE CASCADE,
  promoted_by TEXT REFERENCES sms_profiles(id),
  student_count INTEGER NOT NULL DEFAULT 0,
  undone_at TIMESTAMP WITH TIME ZONE,
  undone_by TEXT REFERENCES sms_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT sms_class_promotions_distinct_classes CHECK (source_class_id <> target_class_id)
);

-- Per-student rows capture the exact prior state. Without these, an undo
-- would have to guess what grade level each student came from, which is
-- unrecoverable once the cohort spans more than one grade.
CREATE TABLE IF NOT EXISTS sms_class_promotion_students (
  promotion_id UUID NOT NULL REFERENCES sms_class_promotions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  previous_grade_level TEXT,
  previous_academic_year TEXT,
  PRIMARY KEY (promotion_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_class_promotions_source ON sms_class_promotions(source_class_id);
CREATE INDEX IF NOT EXISTS idx_sms_class_promotions_target ON sms_class_promotions(target_class_id);

ALTER TABLE sms_class_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_class_promotion_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_promotions: admin all" ON sms_class_promotions;
CREATE POLICY "class_promotions: admin all" ON sms_class_promotions
  FOR ALL USING (sms_current_role() = 'admin');

DROP POLICY IF EXISTS "class_promotion_students: admin all" ON sms_class_promotion_students;
CREATE POLICY "class_promotion_students: admin all" ON sms_class_promotion_students
  FOR ALL USING (sms_current_role() = 'admin');

-- -----------------------------------------------------
-- 3. Preview
--
-- Read-only: exactly who would move, and who would be skipped because
-- they are already enrolled in the target. The admin sees this list and
-- the resulting grade change BEFORE committing -- a rollover is a bulk
-- write across a whole cohort, and it should never be a surprise.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION sms_preview_class_promotion(
  p_source_class_id UUID,
  p_target_class_id UUID
)
RETURNS TABLE (
  student_id UUID,
  first_name TEXT,
  last_name TEXT,
  current_grade_level TEXT,
  current_academic_year TEXT,
  already_in_target BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.first_name,
    s.last_name,
    s.grade_level,
    s.academic_year,
    EXISTS (
      SELECT 1 FROM sms_class_enrollments te
      WHERE te.class_id = p_target_class_id
        AND te.student_id = s.id
        AND te.status = 'active'
    )
  FROM sms_class_enrollments e
  JOIN sms_students s ON s.id = e.student_id
  WHERE e.class_id = p_source_class_id
    AND e.status = 'active'
  ORDER BY s.last_name, s.first_name;
$$;

-- -----------------------------------------------------
-- 4. Promote
--
-- Idempotent: a student already active in the target is skipped rather
-- than duplicated, so a retry after a network failure is safe.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION sms_promote_class(
  p_source_class_id UUID,
  p_target_class_id UUID,
  p_actor_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promotion_id UUID;
  v_target_grade TEXT;
  v_target_year TEXT;
  v_count INTEGER;
BEGIN
  IF p_source_class_id = p_target_class_id THEN
    RAISE EXCEPTION 'Source and target class must be different';
  END IF;

  SELECT grade_level, academic_year INTO v_target_grade, v_target_year
  FROM sms_classes WHERE id = p_target_class_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target class not found';
  END IF;

  INSERT INTO sms_class_promotions (source_class_id, target_class_id, promoted_by)
  VALUES (p_source_class_id, p_target_class_id, p_actor_id)
  RETURNING id INTO v_promotion_id;

  -- The cohort being moved, captured once so every later step operates on
  -- the same set even though the enrollment rows change underneath.
  CREATE TEMP TABLE tmp_promoting ON COMMIT DROP AS
  SELECT s.id AS student_id, s.grade_level, s.academic_year
  FROM sms_class_enrollments e
  JOIN sms_students s ON s.id = e.student_id
  WHERE e.class_id = p_source_class_id
    AND e.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM sms_class_enrollments te
      WHERE te.class_id = p_target_class_id
        AND te.student_id = s.id
        AND te.status = 'active'
    );

  INSERT INTO sms_class_promotion_students (promotion_id, student_id, previous_grade_level, previous_academic_year)
  SELECT v_promotion_id, student_id, grade_level, academic_year FROM tmp_promoting;

  INSERT INTO sms_class_enrollments (class_id, student_id, status)
  SELECT p_target_class_id, student_id, 'active' FROM tmp_promoting
  ON CONFLICT (class_id, student_id) DO UPDATE SET status = 'active';

  UPDATE sms_class_enrollments e
  SET status = 'promoted'
  FROM tmp_promoting t
  WHERE e.class_id = p_source_class_id AND e.student_id = t.student_id;

  -- The student's own grade/year follows the class they now sit in.
  UPDATE sms_students s
  SET grade_level = COALESCE(v_target_grade, s.grade_level),
      academic_year = COALESCE(v_target_year, s.academic_year),
      updated_at = NOW()
  FROM tmp_promoting t
  WHERE s.id = t.student_id;

  SELECT COUNT(*) INTO v_count FROM tmp_promoting;
  UPDATE sms_class_promotions SET student_count = v_count WHERE id = v_promotion_id;

  RETURN v_promotion_id;
END;
$$;

-- -----------------------------------------------------
-- 5. Undo
--
-- Restores each student to the exact grade level and academic year they
-- held before, reactivates their source enrollment, and removes the
-- target enrollment this promotion created. Only rows this promotion
-- touched are affected, so a student manually added to the target class
-- afterwards is left alone.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION sms_undo_class_promotion(
  p_promotion_id UUID,
  p_actor_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source UUID;
  v_target UUID;
  v_count INTEGER;
BEGIN
  SELECT source_class_id, target_class_id INTO v_source, v_target
  FROM sms_class_promotions
  WHERE id = p_promotion_id AND undone_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Promotion not found, or it has already been undone';
  END IF;

  UPDATE sms_students s
  SET grade_level = ps.previous_grade_level,
      academic_year = ps.previous_academic_year,
      updated_at = NOW()
  FROM sms_class_promotion_students ps
  WHERE ps.promotion_id = p_promotion_id AND s.id = ps.student_id;

  UPDATE sms_class_enrollments e
  SET status = 'active'
  FROM sms_class_promotion_students ps
  WHERE ps.promotion_id = p_promotion_id
    AND e.class_id = v_source
    AND e.student_id = ps.student_id;

  DELETE FROM sms_class_enrollments e
  USING sms_class_promotion_students ps
  WHERE ps.promotion_id = p_promotion_id
    AND e.class_id = v_target
    AND e.student_id = ps.student_id;

  SELECT COUNT(*) INTO v_count
  FROM sms_class_promotion_students WHERE promotion_id = p_promotion_id;

  UPDATE sms_class_promotions
  SET undone_at = NOW(), undone_by = p_actor_id
  WHERE id = p_promotion_id;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION sms_promote_class(UUID, UUID, TEXT) FROM anon, authenticated;
REVOKE ALL ON FUNCTION sms_undo_class_promotion(UUID, TEXT) FROM anon, authenticated;
