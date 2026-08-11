-- =====================================================
-- CHAT SYSTEM (relationship-restricted 1:1 messaging)
-- =====================================================
-- Unlike a fully-open "anyone can message anyone" design, this is
-- deliberately restricted to legitimate relationships -- this is a
-- real school system with children, so a teacher/student pair with
-- no actual class relationship, or two unrelated students, must not
-- be able to open a conversation at all.
--
-- sms_can_chat(a, b) is the single gate, checked ONLY at conversation
-- creation (RLS INSERT WITH CHECK) -- not re-checked on every message
-- read, so the read path stays a simple participant check. A
-- conversation that exists has already passed the relationship gate.
--
-- This is the highest-risk migration in this batch given this repo's
-- RLS recursion history (003, 005). Test directly in the Supabase SQL
-- editor against all three roles -- including a same-role
-- non-participant and a valid-role-but-unrelated pair, both expecting
-- denial -- before wiring up any UI to this.
-- =====================================================

CREATE TABLE IF NOT EXISTS sms_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a TEXT NOT NULL REFERENCES sms_profiles(id) ON DELETE CASCADE,
  user_b TEXT NOT NULL REFERENCES sms_profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES sms_conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES sms_profiles(id),
  content TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sms_messages_conversation_created ON sms_messages(conversation_id, created_at);

-- =====================================================
-- Relationship gate. Takes explicit profile ids (not
-- sms_current_user_id()) since it must evaluate an arbitrary pair at
-- conversation-creation time, not just "does the caller relate to X".
-- =====================================================
CREATE OR REPLACE FUNCTION sms_can_chat(a TEXT, b TEXT)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- either party is admin: admin can reach anyone, anyone can reach admin
    EXISTS (SELECT 1 FROM sms_profiles WHERE id IN (a, b) AND role = 'admin')
    -- open faculty communication: any teacher <-> any teacher
    OR (
      (SELECT role FROM sms_profiles WHERE id = a) = 'teacher'
      AND (SELECT role FROM sms_profiles WHERE id = b) = 'teacher'
    )
    -- teacher <-> a student they actually teach
    OR EXISTS (
      SELECT 1 FROM sms_class_enrollments ce
      JOIN sms_classes c ON c.id = ce.class_id
      JOIN sms_teachers t ON t.id = c.teacher_id
      JOIN sms_students s ON s.id = ce.student_id
      WHERE (t.profile_id = a AND s.profile_id = b)
         OR (t.profile_id = b AND s.profile_id = a)
    )
    -- teacher <-> the parent of a student they teach
    OR EXISTS (
      SELECT 1 FROM sms_class_enrollments ce
      JOIN sms_classes c ON c.id = ce.class_id
      JOIN sms_teachers t ON t.id = c.teacher_id
      JOIN sms_student_parents sp ON sp.student_id = ce.student_id
      JOIN sms_parents p ON p.id = sp.parent_id
      WHERE (t.profile_id = a AND p.profile_id = b)
         OR (t.profile_id = b AND p.profile_id = a)
    )
    -- linked parent <-> student
    OR EXISTS (
      SELECT 1 FROM sms_student_parents sp
      JOIN sms_students s ON s.id = sp.student_id
      JOIN sms_parents p ON p.id = sp.parent_id
      WHERE (s.profile_id = a AND p.profile_id = b)
         OR (s.profile_id = b AND p.profile_id = a)
    );
$$;

-- Companion read-only helper backing the UI's contact picker -- reuses
-- sms_can_chat rather than duplicating the relationship logic in
-- TypeScript. Callable via supabase.rpc('sms_chat_contacts').
CREATE OR REPLACE FUNCTION sms_chat_contacts()
RETURNS TABLE (profile_id TEXT, first_name TEXT, last_name TEXT, role sms_role)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.last_name, p.role
  FROM sms_profiles p
  WHERE p.id <> sms_current_user_id()
    AND p.is_active
    AND sms_can_chat(sms_current_user_id(), p.id);
$$;

ALTER TABLE sms_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations: admin all" ON sms_conversations
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "conversations: participant read" ON sms_conversations
  FOR SELECT USING (sms_current_user_id() IN (user_a, user_b));

CREATE POLICY "conversations: participant create if related" ON sms_conversations
  FOR INSERT WITH CHECK (
    sms_current_user_id() IN (user_a, user_b) AND sms_can_chat(user_a, user_b)
  );

CREATE POLICY "messages: admin all" ON sms_messages
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "messages: participant read" ON sms_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_conversations c
      WHERE c.id = sms_messages.conversation_id AND sms_current_user_id() IN (c.user_a, c.user_b)
    )
  );

CREATE POLICY "messages: participant send" ON sms_messages
  FOR INSERT WITH CHECK (
    sender_id = sms_current_user_id()
    AND EXISTS (
      SELECT 1 FROM sms_conversations c
      WHERE c.id = sms_messages.conversation_id AND sms_current_user_id() IN (c.user_a, c.user_b)
    )
  );

CREATE POLICY "messages: participant mark read" ON sms_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM sms_conversations c
      WHERE c.id = sms_messages.conversation_id AND sms_current_user_id() IN (c.user_a, c.user_b)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sms_conversations c
      WHERE c.id = sms_messages.conversation_id AND sms_current_user_id() IN (c.user_a, c.user_b)
    )
  );

-- RLS doesn't restrict which columns an UPDATE touches, so the
-- "mark read" policy above would otherwise also let a recipient
-- silently rewrite content/sender_id. Same REVOKE pattern as 004.
REVOKE UPDATE (content, sender_id, attachment_url, conversation_id, created_at) ON sms_messages FROM authenticated;

-- =====================================================
-- Trigger: bump sms_conversations.last_message_at on every new
-- message. SECURITY DEFINER since there's no participant UPDATE
-- policy on sms_conversations -- this column is server-controlled
-- only, never directly writable by a participant.
-- =====================================================
CREATE OR REPLACE FUNCTION sms_messages_touch_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sms_conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_messages_touch_conversation ON sms_messages;
CREATE TRIGGER trg_sms_messages_touch_conversation AFTER INSERT ON sms_messages
  FOR EACH ROW EXECUTE FUNCTION sms_messages_touch_conversation();

-- =====================================================
-- Realtime: add sms_messages to the Realtime publication so the
-- client can subscribe to postgres_changes on it. Idempotent -- safe
-- to rerun.
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sms_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sms_messages;
  END IF;
END $$;
