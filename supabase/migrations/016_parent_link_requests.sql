-- =====================================================
-- PARENT LINK REQUESTS (in-app approve/deny)
-- =====================================================
-- Replaces the previous admin-only way of creating
-- sms_student_parents rows with a parent-initiated request that
-- the target student must approve or deny themselves. Approval
-- inserts into the existing sms_student_parents table via trigger,
-- kept as a DB-level guarantee rather than relying on app code.
-- Denied requests are kept (not deleted) for an audit trail, and can
-- be resent by the parent, which flips the same row back to pending
-- rather than violating the unique constraint with a fresh insert.
-- =====================================================

CREATE TABLE IF NOT EXISTS sms_parent_link_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID NOT NULL REFERENCES sms_parents(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (parent_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_parent_link_requests_student ON sms_parent_link_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_sms_parent_link_requests_parent ON sms_parent_link_requests(parent_id);

ALTER TABLE sms_parent_link_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parent_link_requests: admin all" ON sms_parent_link_requests
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "parent_link_requests: parent read own" ON sms_parent_link_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_parents p WHERE p.id = sms_parent_link_requests.parent_id AND p.profile_id = sms_current_user_id())
  );

CREATE POLICY "parent_link_requests: parent insert own" ON sms_parent_link_requests
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM sms_parents p WHERE p.id = sms_parent_link_requests.parent_id AND p.profile_id = sms_current_user_id())
  );

-- Parent may only resend a request they own, and only denied -> pending.
CREATE POLICY "parent_link_requests: parent resend own denied" ON sms_parent_link_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM sms_parents p WHERE p.id = sms_parent_link_requests.parent_id AND p.profile_id = sms_current_user_id())
    AND status = 'denied'
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sms_parents p WHERE p.id = sms_parent_link_requests.parent_id AND p.profile_id = sms_current_user_id())
    AND status = 'pending'
  );

CREATE POLICY "parent_link_requests: student read own" ON sms_parent_link_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_parent_link_requests.student_id AND s.profile_id = sms_current_user_id())
  );

-- Student may only resolve a request targeting them, and only
-- pending -> approved/denied (can't reopen or edit anything else).
CREATE POLICY "parent_link_requests: student resolve own" ON sms_parent_link_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_parent_link_requests.student_id AND s.profile_id = sms_current_user_id())
    AND status = 'pending'
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_parent_link_requests.student_id AND s.profile_id = sms_current_user_id())
    AND status IN ('approved', 'denied')
  );

-- RLS doesn't restrict individual columns, so without this a student
-- resolving a request could also silently rewrite parent_id/student_id
-- via the same UPDATE. Same defense-in-depth pattern as 004's
-- REVOKE UPDATE (role, is_active, email) ON sms_profiles.
REVOKE UPDATE (parent_id, student_id, requested_at) ON sms_parent_link_requests FROM authenticated;

-- =====================================================
-- Trigger: keep resolved_at in sync with status transitions.
-- =====================================================
CREATE OR REPLACE FUNCTION sms_parent_link_requests_set_resolved()
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

DROP TRIGGER IF EXISTS trg_sms_parent_link_requests_resolved ON sms_parent_link_requests;
CREATE TRIGGER trg_sms_parent_link_requests_resolved BEFORE UPDATE ON sms_parent_link_requests
  FOR EACH ROW EXECUTE FUNCTION sms_parent_link_requests_set_resolved();

-- =====================================================
-- Trigger: approval creates the actual sms_student_parents link.
-- SECURITY DEFINER so it can write sms_student_parents regardless
-- of the student's own RLS grants on that table.
-- =====================================================
CREATE OR REPLACE FUNCTION sms_parent_link_requests_apply_approval()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    INSERT INTO sms_student_parents (student_id, parent_id)
    VALUES (NEW.student_id, NEW.parent_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_parent_link_requests_apply_approval ON sms_parent_link_requests;
CREATE TRIGGER trg_sms_parent_link_requests_apply_approval AFTER UPDATE ON sms_parent_link_requests
  FOR EACH ROW EXECUTE FUNCTION sms_parent_link_requests_apply_approval();
