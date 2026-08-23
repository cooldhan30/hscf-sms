-- =====================================================
-- 052: TEACHER WORKSHEETS (Worksheet Generator persistence)
--
-- A generated worksheet is a teacher's own personal draft/tool output,
-- not a shared class library resource -- scoped strictly to owner +
-- admin, same as sms_teacher_stories (051_teacher_stories.sql).
--
-- content is a discriminated union of two worksheet types
-- (picture_fillblank / reading_comprehension) -- see
-- lib/worksheetTypes.ts. No image_key column: picture_fillblank uses a
-- curated Tamil word-to-emoji dictionary (lib/tamilVocabEmoji.ts)
-- instead of a generated illustration, and reading_comprehension never
-- needed one.
-- =====================================================

CREATE TABLE IF NOT EXISTS sms_teacher_worksheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by TEXT NOT NULL REFERENCES sms_profiles(id),
  theme TEXT NOT NULL,
  content JSONB NOT NULL,
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
