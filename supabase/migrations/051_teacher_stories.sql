-- =====================================================
-- 051: TEACHER STORIES (Story Generator persistence)
--
-- The Story Generator (Groq-based Tamil story text + ComfyUI-based
-- illustration) previously saved nothing -- both lived only in React
-- state and vanished on refresh. Adds explicit persistence, saved only
-- when the teacher clicks "Save Story" (not auto-saved on every
-- generation), so half-finished or rejected drafts don't clutter the
-- library.
--
-- Unlike sms_resources (a shared class library, readable by any signed-
-- in user), a generated story is a teacher's own personal draft/tool
-- output -- no other role has a reason to see it, so this is scoped
-- strictly to owner + admin, closer to how sms_classes scopes "teacher
-- read own" than to resources' "authenticated read" openness.
-- =====================================================

CREATE TABLE IF NOT EXISTS sms_teacher_stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by TEXT NOT NULL REFERENCES sms_profiles(id),
  theme TEXT NOT NULL,
  story TEXT NOT NULL,
  -- The durable B2 object key (e.g. "story-images/{profileId}/{promptId}.png"),
  -- NOT a signed URL -- /api/story-image/status's signed URLs expire in
  -- an hour, so storing one directly would leave saved stories showing
  -- broken images shortly after save. A fresh signed URL is minted from
  -- this key on every read instead (see app/api/teacher/stories/route.ts).
  image_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_teacher_stories_created_by ON sms_teacher_stories(created_by);

DROP TRIGGER IF EXISTS trg_sms_teacher_stories_updated_at ON sms_teacher_stories;
CREATE TRIGGER trg_sms_teacher_stories_updated_at BEFORE UPDATE ON sms_teacher_stories
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();

ALTER TABLE sms_teacher_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_stories: admin all" ON sms_teacher_stories
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "teacher_stories: teacher manage own" ON sms_teacher_stories
  FOR ALL USING (sms_current_role() = 'teacher' AND created_by = sms_current_user_id())
  WITH CHECK (sms_current_role() = 'teacher' AND created_by = sms_current_user_id());
