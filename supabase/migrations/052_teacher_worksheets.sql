-- =====================================================
-- 052: TEACHER WORKSHEETS (Worksheet Generator persistence)
--
-- Mirrors 051_teacher_stories.sql exactly: a generated worksheet is a
-- teacher's own personal draft/tool output (comprehension passage +
-- questions + vocabulary + word puzzle, generated together from a theme
-- and Nilai level), not a shared class library resource -- scoped
-- strictly to owner + admin, same as sms_teacher_stories.
-- =====================================================

CREATE TABLE IF NOT EXISTS sms_teacher_worksheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by TEXT NOT NULL REFERENCES sms_profiles(id),
  theme TEXT NOT NULL,
  -- Structured worksheet content: { passage, comprehensionQuestions,
  -- vocabulary, wordPuzzle } -- see lib/worksheetTypes.ts. One JSONB
  -- document per worksheet, same "one generation = one artifact" shape
  -- as sms_teacher_stories' single `story` column.
  content JSONB NOT NULL,
  -- Durable B2 object key (e.g. "story-images/{profileId}/{promptId}.png"),
  -- NOT a signed URL -- same convention as sms_teacher_stories.image_key.
  -- A fresh signed URL is minted from this key on every read (see
  -- app/api/teacher/worksheets/route.ts).
  image_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_teacher_worksheets_created_by ON sms_teacher_worksheets(created_by);

DROP TRIGGER IF EXISTS trg_sms_teacher_worksheets_updated_at ON sms_teacher_worksheets;
CREATE TRIGGER trg_sms_teacher_worksheets_updated_at BEFORE UPDATE ON sms_teacher_worksheets
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();

ALTER TABLE sms_teacher_worksheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_worksheets: admin all" ON sms_teacher_worksheets
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "teacher_worksheets: teacher manage own" ON sms_teacher_worksheets
  FOR ALL USING (sms_current_role() = 'teacher' AND created_by = sms_current_user_id())
  WITH CHECK (sms_current_role() = 'teacher' AND created_by = sms_current_user_id());
