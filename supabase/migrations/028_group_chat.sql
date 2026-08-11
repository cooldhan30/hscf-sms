-- =====================================================
-- GROUP CHAT
-- =====================================================
-- Extends the 1:1-only chat system (017) with multi-participant
-- conversations. Existing 1:1 conversations and their RLS behavior are
-- preserved -- user_a/user_b stay as-is for the ordered-pair dedup
-- lookup 1:1 chat already relies on (lib/chat.ts's getOrCreateConversation),
-- but a new sms_conversation_participants table becomes the SOURCE OF
-- TRUTH for RLS on both sms_conversations and sms_messages going
-- forward (backfilled below for every existing row), so read/write
-- access no longer depends on the two-column user_a/user_b shape at all.
--
-- Same recursion caution as 017/019/021: the participant-membership
-- check is wrapped in ONE self-contained SECURITY DEFINER function
-- (sms_is_conversation_participant) used by every policy on both
-- tables, rather than each policy inlining its own subquery -- a policy
-- on sms_conversation_participants that inline-queried sms_conversations
-- (or vice versa) would reintroduce the infinite-recursion class of bug
-- this repo has hit before.
-- =====================================================

ALTER TABLE sms_conversations
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES sms_profiles(id);

ALTER TABLE sms_conversations ALTER COLUMN user_a DROP NOT NULL;
ALTER TABLE sms_conversations ALTER COLUMN user_b DROP NOT NULL;

ALTER TABLE sms_conversations DROP CONSTRAINT IF EXISTS sms_conversations_check;
ALTER TABLE sms_conversations
  ADD CONSTRAINT sms_conversations_check CHECK (
    is_group OR (user_a IS NOT NULL AND user_b IS NOT NULL AND (user_a COLLATE "C") < (user_b COLLATE "C"))
  );

CREATE TABLE IF NOT EXISTS sms_conversation_participants (
  conversation_id UUID NOT NULL REFERENCES sms_conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES sms_profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

-- Backfill: every existing 1:1 conversation's two participants.
INSERT INTO sms_conversation_participants (conversation_id, user_id)
SELECT id, user_a FROM sms_conversations WHERE user_a IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO sms_conversation_participants (conversation_id, user_id)
SELECT id, user_b FROM sms_conversations WHERE user_b IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION sms_is_conversation_participant(p_conversation_id UUID)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = sms_current_user_id()
  );
$$;

ALTER TABLE sms_conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants: admin all" ON sms_conversation_participants
  FOR ALL USING (sms_current_role() = 'admin');

-- Two SELECT policies (OR'd together, standard multiple-permissive-
-- policy behavior): your own membership rows always visible (needed
-- before you're confirmed as a participant of anything, e.g. right
-- after your own insert), plus every row in a conversation you're
-- already confirmed part of (so the UI can list "who's in this group").
CREATE POLICY "participants: self read own membership" ON sms_conversation_participants
  FOR SELECT USING (user_id = sms_current_user_id());

CREATE POLICY "participants: co-member read" ON sms_conversation_participants
  FOR SELECT USING (sms_is_conversation_participant(conversation_id));

-- Join yourself (creating/accepting), or add someone else to a
-- conversation you're already in -- gated by the same sms_can_chat
-- relationship check 1:1 conversations use, so group chat can't be used
-- to route around it.
CREATE POLICY "participants: insert self or invite chattable" ON sms_conversation_participants
  FOR INSERT WITH CHECK (
    user_id = sms_current_user_id()
    OR (sms_is_conversation_participant(conversation_id) AND sms_can_chat(sms_current_user_id(), user_id))
  );

CREATE POLICY "participants: self leave" ON sms_conversation_participants
  FOR DELETE USING (user_id = sms_current_user_id());

-- ==== sms_conversations: swap user_a/user_b checks for the participant helper ====
DROP POLICY IF EXISTS "conversations: participant read" ON sms_conversations;
CREATE POLICY "conversations: participant read" ON sms_conversations
  FOR SELECT USING (sms_is_conversation_participant(id));

DROP POLICY IF EXISTS "conversations: participant create if related" ON sms_conversations;
CREATE POLICY "conversations: create 1:1 if related" ON sms_conversations
  FOR INSERT WITH CHECK (
    (NOT is_group AND sms_current_user_id() IN (user_a, user_b) AND sms_can_chat(user_a, user_b))
  );

-- Separate policy for groups: creator just needs to be who they say they
-- are. The actual member-relationship gating happens per-participant via
-- the "insert self or invite chattable" policy above when each member
-- row gets added, not here.
CREATE POLICY "conversations: create group as self" ON sms_conversations
  FOR INSERT WITH CHECK (is_group AND created_by = sms_current_user_id());

-- ==== sms_messages: swap user_a/user_b checks for the participant helper ====
DROP POLICY IF EXISTS "messages: participant read" ON sms_messages;
CREATE POLICY "messages: participant read" ON sms_messages
  FOR SELECT USING (sms_is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "messages: participant send" ON sms_messages;
CREATE POLICY "messages: participant send" ON sms_messages
  FOR INSERT WITH CHECK (sender_id = sms_current_user_id() AND sms_is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "messages: participant mark read" ON sms_messages;
CREATE POLICY "messages: participant mark read" ON sms_messages
  FOR UPDATE USING (sms_is_conversation_participant(conversation_id))
  WITH CHECK (sms_is_conversation_participant(conversation_id));
