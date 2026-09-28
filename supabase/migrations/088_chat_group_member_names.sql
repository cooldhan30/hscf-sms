-- 088: chat -- members of the same conversation can see each other's names.
--
-- ROOT CAUSE: sms_profiles is readable by others only through
--   "profiles: authenticated read teacher directory" (teachers) and
--   "profiles: chat participant read", which matches the 1:1 pair columns
--   (sms_conversations.user_a / user_b) only. Group chats (028) keep
--   membership in sms_conversation_participants and leave user_a/user_b
--   empty, so in a group every non-teacher member's profile was invisible:
--   lib/chat.ts listConversations() got user = null for them and dropped
--   them, and the thread could not name who sent a message.
--
-- FIX: one more SELECT policy -- you can read the profile of anyone who is
--   a participant in a conversation you are also a participant in. Same
--   visibility the 1:1 policy already grants, extended to group members.
--   The helper is SECURITY DEFINER so the policy doesn't recurse through
--   sms_conversation_participants' own RLS.

CREATE OR REPLACE FUNCTION sms_shares_conversation_with(p_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM sms_conversation_participants mine
    JOIN sms_conversation_participants theirs ON theirs.conversation_id = mine.conversation_id
    WHERE mine.user_id = sms_current_user_id()
      AND theirs.user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION sms_shares_conversation_with(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sms_shares_conversation_with(text) TO authenticated;

DROP POLICY IF EXISTS "profiles: conversation member read" ON sms_profiles;
CREATE POLICY "profiles: conversation member read" ON sms_profiles
  FOR SELECT USING (sms_shares_conversation_with(id));
