-- =====================================================
-- CLASS JOIN CODES (teacher + student self-join, with approval gates)
-- =====================================================
-- Admin's existing direct-assign (teacher dropdown) and direct-enroll
-- (student picker) flows are UNCHANGED and stay as an override. This
-- adds a self-service path on top: admin hands out a class's join code;
-- a teacher enters it to request being attached (admin approves/denies
-- -- a class already having a teacher does NOT block a new request, it
-- just goes to admin as pending, admin's call); once a class has that
-- code, students enter it to request joining (the class's own teacher
-- approves/denies each one).
--
-- Shape mirrors 016_parent_link_requests.sql exactly: a pending/approved
-- /denied request table, RLS scoped to "my own requests" (insert + read
-- + resend-if-denied) plus "the approver's own scope", and an AFTER
-- UPDATE SECURITY DEFINER trigger that applies the real effect only on
-- approval. The join-code lookup itself reuses the SECURITY DEFINER
-- narrow-lookup pattern from 018 (there: student by email; here: class
-- by code), since a teacher/student not yet attached to a class can't
-- read that class's row under existing RLS.
-- =====================================================

-- =====================================================
-- 1. Join codes on sms_classes
-- =====================================================
CREATE OR REPLACE FUNCTION sms_generate_join_code()
RETURNS text
LANGUAGE sql
AS $$
  -- 8 chars from an unambiguous 32-symbol alphabet (no 0/O/1/I/L) --
  -- ~40 bits of entropy, effectively collision-free for a small school.
  SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', ceil(random() * 32)::int, 1), '')
  FROM generate_series(1, 8);
$$;

ALTER TABLE sms_classes ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE DEFAULT sms_generate_join_code();

-- Read-only lookup: resolve a code to a class without needing any RLS
-- read access to sms_classes itself. Minimal columns only.
CREATE OR REPLACE FUNCTION sms_resolve_class_by_join_code(p_code TEXT)
RETURNS TABLE (class_id UUID, class_name TEXT, has_teacher BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, teacher_id IS NOT NULL
  FROM sms_classes
  WHERE join_code = p_code;
$$;

-- =====================================================
-- 2. Teacher join requests (admin resolves)
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_class_teacher_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES sms_classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES sms_teachers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (class_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_class_teacher_requests_class ON sms_class_teacher_requests(class_id);

ALTER TABLE sms_class_teacher_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_teacher_requests: admin all" ON sms_class_teacher_requests
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "class_teacher_requests: teacher read own" ON sms_class_teacher_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_teachers t WHERE t.id = sms_class_teacher_requests.teacher_id AND t.profile_id = sms_current_user_id())
  );

CREATE POLICY "class_teacher_requests: teacher insert own" ON sms_class_teacher_requests
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM sms_teachers t WHERE t.id = sms_class_teacher_requests.teacher_id AND t.profile_id = sms_current_user_id())
  );

-- Only admin resolves these (no teacher UPDATE-to-approve policy) --
-- but a teacher may resend their own denied request back to pending,
-- same as the parent-link pattern.
CREATE POLICY "class_teacher_requests: teacher resend own denied" ON sms_class_teacher_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM sms_teachers t WHERE t.id = sms_class_teacher_requests.teacher_id AND t.profile_id = sms_current_user_id())
    AND status = 'denied'
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sms_teachers t WHERE t.id = sms_class_teacher_requests.teacher_id AND t.profile_id = sms_current_user_id())
    AND status = 'pending'
  );

REVOKE UPDATE (class_id, teacher_id, requested_at) ON sms_class_teacher_requests FROM authenticated;

CREATE OR REPLACE FUNCTION sms_class_teacher_requests_set_resolved()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status <> 'pending' AND OLD.status = 'pending' THEN
    NEW.resolved_at = NOW();
  ELSIF NEW.status = 'pending' AND OLD.status = 'denied' THEN
    NEW.resolved_at = NULL;
    NEW.requested_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_class_teacher_requests_resolved ON sms_class_teacher_requests;
CREATE TRIGGER trg_sms_class_teacher_requests_resolved BEFORE UPDATE ON sms_class_teacher_requests
  FOR EACH ROW EXECUTE FUNCTION sms_class_teacher_requests_set_resolved();

-- Approval sets sms_classes.teacher_id -- overwrites any existing
-- teacher, since a second request against an already-taught class is
-- allowed through to admin, who decides.
CREATE OR REPLACE FUNCTION sms_class_teacher_requests_apply_approval()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    UPDATE sms_classes SET teacher_id = NEW.teacher_id WHERE id = NEW.class_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_class_teacher_requests_apply_approval ON sms_class_teacher_requests;
CREATE TRIGGER trg_sms_class_teacher_requests_apply_approval AFTER UPDATE ON sms_class_teacher_requests
  FOR EACH ROW EXECUTE FUNCTION sms_class_teacher_requests_apply_approval();

-- =====================================================
-- 3. Student join requests (the class's own teacher resolves)
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_class_join_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES sms_classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (class_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_class_join_requests_class ON sms_class_join_requests(class_id);

ALTER TABLE sms_class_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_join_requests: admin all" ON sms_class_join_requests
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "class_join_requests: student read own" ON sms_class_join_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_class_join_requests.student_id AND s.profile_id = sms_current_user_id())
  );

CREATE POLICY "class_join_requests: student insert own" ON sms_class_join_requests
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_class_join_requests.student_id AND s.profile_id = sms_current_user_id())
  );

CREATE POLICY "class_join_requests: student resend own denied" ON sms_class_join_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_class_join_requests.student_id AND s.profile_id = sms_current_user_id())
    AND status = 'denied'
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_class_join_requests.student_id AND s.profile_id = sms_current_user_id())
    AND status = 'pending'
  );

-- The class's own teacher resolves pending requests -- reuses the
-- existing sms_teacher_owns_class() helper from 004/014, no new helper
-- needed, and no recursion risk (that helper already only reads
-- sms_classes/sms_teachers, neither of which reads this table back).
CREATE POLICY "class_join_requests: teacher resolve own class" ON sms_class_join_requests
  FOR SELECT USING (sms_teacher_owns_class(class_id));

CREATE POLICY "class_join_requests: teacher resolve own class pending" ON sms_class_join_requests
  FOR UPDATE USING (sms_teacher_owns_class(class_id) AND status = 'pending')
  WITH CHECK (sms_teacher_owns_class(class_id) AND status IN ('approved', 'denied'));

REVOKE UPDATE (class_id, student_id, requested_at) ON sms_class_join_requests FROM authenticated;

CREATE OR REPLACE FUNCTION sms_class_join_requests_set_resolved()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status <> 'pending' AND OLD.status = 'pending' THEN
    NEW.resolved_at = NOW();
  ELSIF NEW.status = 'pending' AND OLD.status = 'denied' THEN
    NEW.resolved_at = NULL;
    NEW.requested_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_class_join_requests_resolved ON sms_class_join_requests;
CREATE TRIGGER trg_sms_class_join_requests_resolved BEFORE UPDATE ON sms_class_join_requests
  FOR EACH ROW EXECUTE FUNCTION sms_class_join_requests_set_resolved();

CREATE OR REPLACE FUNCTION sms_class_join_requests_apply_approval()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    INSERT INTO sms_class_enrollments (class_id, student_id, status)
    VALUES (NEW.class_id, NEW.student_id, 'active')
    ON CONFLICT (class_id, student_id) DO UPDATE SET status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_class_join_requests_apply_approval ON sms_class_join_requests;
CREATE TRIGGER trg_sms_class_join_requests_apply_approval AFTER UPDATE ON sms_class_join_requests
  FOR EACH ROW EXECUTE FUNCTION sms_class_join_requests_apply_approval();

-- =====================================================
-- 4. Teacher "kick out" -- write access to their own class's enrollments
-- =====================================================
-- Additive to the existing "enrollments: teacher read own class rosters"
-- SELECT policy from 003 (multiple permissive policies for the same
-- command OR together, so this doesn't remove anything). FOR ALL matches
-- the same convention already used for attendance/assignments/grades
-- ("teacher manage own class/assignment").
CREATE POLICY "enrollments: teacher manage own class" ON sms_class_enrollments
  FOR ALL USING (sms_teacher_owns_class(class_id));
