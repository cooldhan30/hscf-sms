-- =====================================================
-- 032: IN-APP NOTIFICATIONS
--
-- Notifications are raised by DATABASE TRIGGERS, not by the API routes
-- that happen to write the row. The same event can arrive through more
-- than one path -- a grade can be saved by the teacher gradebook route
-- or by an admin acting with the service role, chat messages are written
-- from two different clients -- and an app-layer notify() call has to be
-- remembered at every one of them. A trigger fires for all of them,
-- including paths added later, and cannot be forgotten.
--
-- The `link` column stores a ROLE-RELATIVE path ('/grades', '/chat').
-- Each portal lives under its own prefix, and the same notification can
-- go to a student and their parent, who reach the same information at
-- different URLs. The bell prepends the reader's own prefix.
-- =====================================================

CREATE TABLE IF NOT EXISTS sms_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id TEXT NOT NULL REFERENCES sms_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- The bell's only query: this person's notifications, newest first, with
-- unread counted. Partial index keeps the unread badge cheap.
CREATE INDEX IF NOT EXISTS idx_sms_notifications_profile_created
  ON sms_notifications(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_unread
  ON sms_notifications(profile_id) WHERE read_at IS NULL;

ALTER TABLE sms_notifications ENABLE ROW LEVEL SECURITY;

-- You see only your own, and the only thing you may change is whether
-- you have read it. Inserts come from the SECURITY DEFINER triggers
-- below, never from a client.
DROP POLICY IF EXISTS "notifications: read own" ON sms_notifications;
CREATE POLICY "notifications: read own" ON sms_notifications
  FOR SELECT USING (profile_id = sms_current_user_id());

DROP POLICY IF EXISTS "notifications: mark own read" ON sms_notifications;
CREATE POLICY "notifications: mark own read" ON sms_notifications
  FOR UPDATE USING (profile_id = sms_current_user_id());

-- -----------------------------------------------------
-- Helper
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION sms_notify(
  p_profile_id TEXT,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_link TEXT
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Nobody is notified about their own action, and a null recipient
  -- (e.g. a student with no login yet) is simply skipped.
  IF p_profile_id IS NULL THEN RETURN; END IF;

  INSERT INTO sms_notifications (profile_id, type, title, body, link)
  VALUES (p_profile_id, p_type, p_title, p_body, p_link);
END;
$$;

-- Everyone who should hear about something concerning this student:
-- the student themselves if they have a login, plus every linked parent.
CREATE OR REPLACE FUNCTION sms_student_audience(p_student_id UUID)
RETURNS TABLE (profile_id TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.profile_id FROM sms_students s
  WHERE s.id = p_student_id AND s.profile_id IS NOT NULL
  UNION
  SELECT p.profile_id FROM sms_student_parents sp
  JOIN sms_parents p ON p.id = sp.parent_id
  WHERE sp.student_id = p_student_id AND p.profile_id IS NOT NULL;
$$;

-- -----------------------------------------------------
-- 1. Chat message -> every other participant
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION sms_notify_on_message()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender TEXT;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(first_name || ' ' || last_name), ''), 'Someone')
  INTO v_sender FROM sms_profiles WHERE id = NEW.sender_id;

  PERFORM sms_notify(
    cp.user_id,
    'chat',
    v_sender || ' sent you a message',
    LEFT(NEW.content, 140),
    '/chat'
  )
  FROM sms_conversation_participants cp
  WHERE cp.conversation_id = NEW.conversation_id
    AND cp.user_id <> NEW.sender_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_messages_notify ON sms_messages;
CREATE TRIGGER trg_sms_messages_notify
  AFTER INSERT ON sms_messages
  FOR EACH ROW EXECUTE FUNCTION sms_notify_on_message();

-- -----------------------------------------------------
-- 2. Assignment published -> enrolled students and their parents
--
-- Fires on the transition to published, not on every save, so editing a
-- live assignment doesn't re-notify the whole class.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION sms_notify_on_assignment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class TEXT;
BEGIN
  IF NOT NEW.published THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.published THEN RETURN NEW; END IF;

  SELECT name INTO v_class FROM sms_classes WHERE id = NEW.class_id;

  PERFORM sms_notify(
    a.profile_id,
    'assignment',
    'New assignment: ' || NEW.title,
    COALESCE(v_class, 'Your class') ||
      CASE WHEN NEW.due_date IS NOT NULL THEN ' - due ' || TO_CHAR(NEW.due_date, 'Mon DD') ELSE '' END,
    '/assignments'
  )
  FROM sms_class_enrollments e
  CROSS JOIN LATERAL sms_student_audience(e.student_id) a
  WHERE e.class_id = NEW.class_id AND e.status = 'active';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_assignments_notify ON sms_assignments;
CREATE TRIGGER trg_sms_assignments_notify
  AFTER INSERT OR UPDATE OF published ON sms_assignments
  FOR EACH ROW EXECUTE FUNCTION sms_notify_on_assignment();

-- -----------------------------------------------------
-- 3. Grade posted -> the student and their parents
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION sms_notify_on_grade()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
BEGIN
  IF NEW.score IS NULL THEN RETURN NEW; END IF;
  -- Only when the score first appears or actually changes.
  IF TG_OP = 'UPDATE' AND OLD.score IS NOT DISTINCT FROM NEW.score THEN RETURN NEW; END IF;

  SELECT title INTO v_title FROM sms_assignments WHERE id = NEW.assignment_id;

  PERFORM sms_notify(
    a.profile_id,
    'grade',
    'Grade posted: ' || COALESCE(v_title, 'assignment'),
    'Score: ' || NEW.score,
    '/grades'
  )
  FROM sms_student_audience(NEW.student_id) a;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_grades_notify ON sms_grades;
CREATE TRIGGER trg_sms_grades_notify
  AFTER INSERT OR UPDATE OF score ON sms_grades
  FOR EACH ROW EXECUTE FUNCTION sms_notify_on_grade();

-- -----------------------------------------------------
-- 4. Teacher asks to join a class -> every admin
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION sms_notify_on_teacher_request()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher TEXT;
  v_class TEXT;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''), 'A teacher')
  INTO v_teacher
  FROM sms_teachers t JOIN sms_profiles p ON p.id = t.profile_id
  WHERE t.id = NEW.teacher_id;

  SELECT name INTO v_class FROM sms_classes WHERE id = NEW.class_id;

  -- Every admin, so this never depends on one person being on duty.
  PERFORM sms_notify(
    pr.profile_id,
    'teacher_request',
    v_teacher || ' requested to teach ' || COALESCE(v_class, 'a class'),
    'Waiting for approval',
    '/classes/' || NEW.class_id
  )
  FROM sms_profile_roles pr
  WHERE pr.role = 'admin';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_class_teacher_requests_notify ON sms_class_teacher_requests;
CREATE TRIGGER trg_sms_class_teacher_requests_notify
  AFTER INSERT ON sms_class_teacher_requests
  FOR EACH ROW EXECUTE FUNCTION sms_notify_on_teacher_request();

-- -----------------------------------------------------
-- 5. Student asks to join a class -> that class's teacher
-- -----------------------------------------------------
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

  SELECT c.name, t.profile_id INTO v_class, v_teacher_profile
  FROM sms_classes c LEFT JOIN sms_teachers t ON t.id = c.teacher_id
  WHERE c.id = NEW.class_id;

  PERFORM sms_notify(
    v_teacher_profile,
    'join_request',
    COALESCE(v_student, 'A student') || ' asked to join ' || COALESCE(v_class, 'your class'),
    'Waiting for approval',
    '/classes/' || NEW.class_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_class_join_requests_notify ON sms_class_join_requests;
CREATE TRIGGER trg_sms_class_join_requests_notify
  AFTER INSERT ON sms_class_join_requests
  FOR EACH ROW EXECUTE FUNCTION sms_notify_on_join_request();

-- -----------------------------------------------------
-- 6. Promotion -> each promoted student and their parents
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION sms_notify_on_promotion()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class TEXT;
BEGIN
  SELECT c.name INTO v_class
  FROM sms_class_promotions pr JOIN sms_classes c ON c.id = pr.target_class_id
  WHERE pr.id = NEW.promotion_id;

  PERFORM sms_notify(
    a.profile_id,
    'promotion',
    'Moved up to ' || COALESCE(v_class, 'the next class'),
    'Your class for the new school year',
    '/classes'
  )
  FROM sms_student_audience(NEW.student_id) a;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_promotion_students_notify ON sms_class_promotion_students;
CREATE TRIGGER trg_sms_promotion_students_notify
  AFTER INSERT ON sms_class_promotion_students
  FOR EACH ROW EXECUTE FUNCTION sms_notify_on_promotion();
