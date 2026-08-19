-- =====================================================
-- 049: ANY TEACHER CAN CATEGORIZE ANY RESOURCE
--
-- "resources: teacher manage own" (043) only let a teacher UPDATE a
-- resource they themselves uploaded -- correct for editing the file's
-- title/class, but too narrow now that categorization (category,
-- subcategory, levels, skills, difficulty, tags -- see 048) needs
-- filling in on the whole shared library, most of which any given
-- teacher didn't personally upload. Confirmed as a real gap: a teacher
-- had no edit icon at all on an admin-uploaded resource they wanted to
-- tag.
--
-- Widen UPDATE to any teacher, any resource -- the app layer
-- (app/api/resources/[id]/route.ts) is responsible for only letting a
-- non-owner change taxonomy/description/title, not class_id/file_url
-- (moving a resource to a different class stays owner-or-admin, a
-- placement decision rather than tagging/renaming), so this is
-- deliberately broader at the RLS layer than what the route actually
-- exposes to a non-owner. DELETE ("resources: teacher delete own") is
-- untouched -- deleting is destructive and stays owner-or-admin only.
-- =====================================================

DROP POLICY IF EXISTS "resources: teacher manage own" ON sms_resources;

CREATE POLICY "resources: teacher manage any" ON sms_resources
  FOR UPDATE USING (sms_current_role() = 'teacher')
  WITH CHECK (sms_current_role() = 'teacher');
