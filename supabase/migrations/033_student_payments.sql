-- =====================================================
-- 033: REGISTRATION PAYMENT TRACKING (admin-only)
--
-- Tracks whether each student's registration fee has been paid, so an
-- admin can check them off a list. This is deliberately NOT a payment
-- gateway -- no card is charged here, nothing talks to a processor.
-- It records what the school already knows about who has paid.
--
-- Keyed by academic year as well as student: the fee is annual, and last
-- year's paid status must not make this year's look settled.
-- =====================================================

CREATE TABLE IF NOT EXISTS sms_student_payments (
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid')),
  marked_by TEXT REFERENCES sms_profiles(id),
  marked_at TIMESTAMP WITH TIME ZONE,
  -- Reminder history lives here rather than in a separate log: the only
  -- questions an admin asks are "have we chased them" and "how recently",
  -- and both are answered without another table or another join.
  last_reminded_at TIMESTAMP WITH TIME ZONE,
  reminder_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_sms_student_payments_year_status
  ON sms_student_payments(academic_year, status);

ALTER TABLE sms_student_payments ENABLE ROW LEVEL SECURITY;

-- Admin-only. Deliberately no parent-read policy: a parent seeing an
-- "unpaid" flag they cannot act on invites confusion, and the school may
-- want to settle fee questions in person. Easy to add later if wanted.
DROP POLICY IF EXISTS "student_payments: admin all" ON sms_student_payments;
CREATE POLICY "student_payments: admin all" ON sms_student_payments
  FOR ALL USING (sms_current_role() = 'admin');

-- -----------------------------------------------------
-- Reminder
--
-- Records that a reminder was sent and notifies every linked parent
-- in-app. Email is NOT sent from here -- no provider is configured (same
-- honesty as the email templates in 013). When one is added, the send
-- happens in the route handler alongside this call; the in-app
-- notification stays either way, since it is the channel that works
-- without a third party.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION sms_send_payment_reminder(
  p_student_id UUID,
  p_academic_year TEXT,
  p_actor_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student TEXT;
  v_notified INTEGER := 0;
BEGIN
  SELECT TRIM(first_name || ' ' || last_name) INTO v_student
  FROM sms_students WHERE id = p_student_id;

  IF v_student IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  INSERT INTO sms_student_payments (student_id, academic_year, last_reminded_at, reminder_count)
  VALUES (p_student_id, p_academic_year, NOW(), 1)
  ON CONFLICT (student_id, academic_year) DO UPDATE
    SET last_reminded_at = NOW(),
        reminder_count = sms_student_payments.reminder_count + 1;

  SELECT COUNT(*) INTO v_notified
  FROM sms_student_parents sp
  JOIN sms_parents pa ON pa.id = sp.parent_id
  WHERE sp.student_id = p_student_id AND pa.profile_id IS NOT NULL;

  PERFORM sms_notify(
    pa.profile_id,
    'payment_reminder',
    'Registration fee reminder',
    'The registration fee for ' || v_student || ' has not been recorded as paid yet.',
    '/children'
  )
  FROM sms_student_parents sp
  JOIN sms_parents pa ON pa.id = sp.parent_id
  WHERE sp.student_id = p_student_id AND pa.profile_id IS NOT NULL;

  RETURN v_notified;
END;
$$;

REVOKE ALL ON FUNCTION sms_send_payment_reminder(UUID, TEXT, TEXT) FROM anon, authenticated;
