-- =====================================================
-- FIX: creating a conversation between some user pairs fails outright
-- =====================================================
-- sms_conversations has CHECK (user_a < user_b) to keep each pair
-- canonically ordered regardless of who starts the conversation.
-- lib/chat.ts's getOrCreateConversation() sorts the two Clerk ids
-- client-side with plain JS `<` (codepoint/byte order). Postgres TEXT
-- comparison uses the column's collation by default, which for mixed-
-- case strings does NOT always agree with codepoint order (e.g. this
-- surfaced between two real ids differing at 'W' vs 'f' -- codepoint
-- order says 'W' < 'f', but the default collation ordered them the
-- other way). When the two disagree, the client's "smaller" id is
-- actually larger under the DB's comparison, the INSERT hits the CHECK
-- constraint, and the conversation is silently never created -- which
-- is exactly why a sent message could appear to "not show up": the
-- whole conversation never existed in the first place.
--
-- Fix: pin the CHECK constraint to COLLATE "C" (strict byte/codepoint
-- order), which matches JavaScript's `<` exactly. No client-side change
-- needed.
-- =====================================================

ALTER TABLE sms_conversations DROP CONSTRAINT IF EXISTS sms_conversations_check;
ALTER TABLE sms_conversations ADD CONSTRAINT sms_conversations_check
  CHECK ((user_a COLLATE "C") < (user_b COLLATE "C"));
