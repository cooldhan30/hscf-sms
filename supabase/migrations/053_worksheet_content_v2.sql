-- =====================================================
-- 053: WORKSHEET CONTENT SCHEMA V2
--
-- The Worksheet Generator's content shape changed incompatibly: from a
-- single flat structure (passage/comprehensionQuestions/vocabulary/
-- wordPuzzle) to a discriminated union of two distinct worksheet types
-- (picture_fillblank / reading_comprehension) with their own visual
-- templates -- see lib/worksheetTypes.ts. Existing saved worksheets
-- predate this schema and cannot be rendered by the new templates.
-- Clearing them rather than writing a one-time transform, since this
-- feature only just shipped and is expected to hold a handful of test
-- rows, not real teacher data.
--
-- Also drops image_key: worksheets no longer carry an illustration --
-- picture_fillblank uses a curated emoji dictionary
-- (lib/tamilVocabEmoji.ts) instead of a ComfyUI-generated image, and
-- reading_comprehension never needed one.
-- =====================================================

TRUNCATE TABLE sms_teacher_worksheets;
ALTER TABLE sms_teacher_worksheets DROP COLUMN IF EXISTS image_key;
