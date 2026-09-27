-- 087: chat -- idempotent, atomic conversation creation + membership hardening.
--
-- ROOT CAUSE (reproduced in a rolled-back transaction, 2026-09-27):
--   lib/chat.ts created a 1:1 chat in three client-side steps: SELECT the
--   pair, INSERT the conversation, then INSERT both participant rows in ONE
--   statement. The participant INSERT policy lets you add someone else only
--   if you are already a participant (sms_is_conversation_participant). That
--   helper is STABLE, so it reads the statement's starting snapshot and
--   cannot see your own row being inserted by the same statement -> the
--   other person's row fails: 'new row violates row-level security policy
--   for table "sms_conversation_participants"'. The conversation row was
--   left behind with ZERO participants, and since 028 a conversation is only
--   readable by its participants, so it became invisible even to its
--   creator. Every later attempt's "does it exist?" SELECT saw nothing and
--   its INSERT hit 'duplicate key value violates unique constraint
--   "sms_conversations_user_a_user_b_key"'. Group creation had the same
--   single-statement failure.
--
-- ALSO FOUND: the same policy's "user_id = me" branch let ANY signed-in
--   user add THEMSELVES to ANY conversation whose id they knew (and then read
--   its messages), and let a 1:1 participant pull a third person into a
--   private 1:1 chat.
--
-- FIX (no RLS disabled, no constraint removed, no service-role key):
--   1. Two SECURITY DEFINER functions own creation, each one atomic and
--      re-checking the same authorization the policies expressed:
--        sms_get_or_create_direct_conversation(other) -- idempotent; the
--          unique (user_a, user_b) pair is the invariant; INSERT ... ON
--          CONFLICT DO NOTHING makes concurrent callers converge on the same
--          row without errors; it also repairs the pair's own membership
--          on conversations orphaned by the old bug.
--        sms_create_group_conversation(name, members)
--   2. The participant INSERT policy is narrowed: you may add yourself only
--      to a 1:1 conversation in which you are user_a/user_b, and you may add
--      someone else only to a GROUP you already belong to, and only someone
--      you could chat with anyway.

-- Helper for policies (SECURITY DEFINER: the caller may not be able to SELECT
-- the conversation row yet, which is exactly the self-repair case).
CREATE OR REPLACE FUNCTION sms_conversation_membership_allowed(p_conversation_id uuid, p_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sms_conversations c
    WHERE c.id = p_conversation_id
      AND (
        -- yourself, into a 1:1 conversation that names you
        (p_user_id = sms_current_user_id() AND NOT c.is_group AND p_user_id IN (c.user_a, c.user_b))
        -- someone else, into a group you already belong to, if you could chat with them
        OR (
          c.is_group
          AND p_user_id <> sms_current_user_id()
          AND sms_is_conversation_participant(c.id)
          AND sms_can_chat(sms_current_user_id(), p_user_id)
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION sms_conversation_membership_allowed(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sms_conversation_membership_allowed(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "participants: insert self or invite chattable" ON sms_conversation_participants;
CREATE POLICY "participants: insert self or invite chattable" ON sms_conversation_participants
  FOR INSERT WITH CHECK (sms_conversation_membership_allowed(conversation_id, user_id));

-- 1:1: open the existing conversation or create exactly one.
CREATE OR REPLACE FUNCTION sms_get_or_create_direct_conversation(p_other_user_id text)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me text := sms_current_user_id();
  v_a text;
  v_b text;
  v_id uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  IF p_other_user_id IS NULL OR p_other_user_id = v_me THEN
    RAISE EXCEPTION 'You cannot start a chat with yourself' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM sms_profiles WHERE id = p_other_user_id AND is_active) THEN
    RAISE EXCEPTION 'You are not able to message this person' USING ERRCODE = '42501';
  END IF;
  IF NOT sms_can_chat(v_me, p_other_user_id) THEN
    RAISE EXCEPTION 'You are not able to message this person' USING ERRCODE = '42501';
  END IF;

  -- Same canonical order the table CHECK enforces (026: COLLATE "C").
  IF (v_me COLLATE "C") < (p_other_user_id COLLATE "C") THEN
    v_a := v_me; v_b := p_other_user_id;
  ELSE
    v_a := p_other_user_id; v_b := v_me;
  END IF;

  INSERT INTO sms_conversations (user_a, user_b)
  VALUES (v_a, v_b)
  ON CONFLICT (user_a, user_b) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    -- Lost the race or it already existed: under READ COMMITTED this
    -- statement sees the winner's committed row.
    SELECT id INTO v_id FROM sms_conversations WHERE user_a = v_a AND user_b = v_b;
  END IF;

  -- Exactly the pair -- never anyone else. Also repairs conversations the
  -- old client flow left without participants.
  INSERT INTO sms_conversation_participants (conversation_id, user_id)
  VALUES (v_id, v_a), (v_id, v_b)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION sms_get_or_create_direct_conversation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sms_get_or_create_direct_conversation(text) TO authenticated;

-- Group: created atomically with all of its members, or not at all.
CREATE OR REPLACE FUNCTION sms_create_group_conversation(p_name text, p_member_ids text[])
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me text := sms_current_user_id();
  v_name text := btrim(coalesce(p_name, ''));
  v_members text[];
  v_member text;
  v_id uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  IF v_name = '' OR length(v_name) > 100 THEN
    RAISE EXCEPTION 'A group needs a name of up to 100 characters' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(array_agg(DISTINCT m), '{}') INTO v_members
  FROM unnest(coalesce(p_member_ids, '{}')) AS m
  WHERE m IS NOT NULL AND m <> v_me;

  IF cardinality(v_members) = 0 THEN
    RAISE EXCEPTION 'Add at least one other person' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_members) > 100 THEN
    RAISE EXCEPTION 'A group can have at most 100 other members' USING ERRCODE = '22023';
  END IF;

  FOREACH v_member IN ARRAY v_members LOOP
    IF NOT EXISTS (SELECT 1 FROM sms_profiles WHERE id = v_member AND is_active)
       OR NOT sms_can_chat(v_me, v_member) THEN
      RAISE EXCEPTION 'You are not able to add one of these people' USING ERRCODE = '42501';
    END IF;
  END LOOP;

  INSERT INTO sms_conversations (is_group, name, created_by)
  VALUES (true, v_name, v_me)
  RETURNING id INTO v_id;

  INSERT INTO sms_conversation_participants (conversation_id, user_id)
  SELECT v_id, u FROM unnest(array_append(v_members, v_me)) AS u;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION sms_create_group_conversation(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sms_create_group_conversation(text, text[]) TO authenticated;
