-- =====================================================
-- FIX: chat conversation list / thread header show "Unknown user"
-- =====================================================
-- lib/chat.ts's listConversations() looks up the OTHER participant's
-- name via sms_profiles (id, first_name, last_name, role) to render the
-- conversation list and thread header. "profiles: read own" only allows
-- reading your own row, so that lookup always came back empty for the
-- other participant -- every conversation rendered as "Unknown user"
-- with a "?" avatar, and the thread pane never opened at all (ChatApp
-- only renders ChatThread when `selected.otherUser` is present).
--
-- Fix: a participant may read the OTHER participant's basic profile
-- info, scoped to conversations that already exist between them. No
-- recursion risk -- sms_conversations' own policies never reference
-- sms_profiles, so there's no cycle to break with a SECURITY DEFINER
-- helper here (unlike 003/004/005/019).
-- =====================================================

CREATE POLICY "profiles: chat participant read" ON sms_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_conversations c
      WHERE (c.user_a = sms_current_user_id() AND c.user_b = sms_profiles.id)
         OR (c.user_b = sms_current_user_id() AND c.user_a = sms_profiles.id)
    )
  );
