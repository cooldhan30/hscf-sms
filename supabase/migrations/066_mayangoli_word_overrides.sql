-- =====================================================
-- 066: MAYANGOLI word bank admin overrides
--
-- The 315-word Mayangoli bank itself lives as a static, build-time
-- validated TypeScript file (lib/gameRoom/modules/mayangoli/wordBank.ts)
-- -- every word's grapheme/target-letter/distractor shape is verified
-- at module load (buildMayangoliWord), so the actual word content stays
-- code, not runtime-editable data (matches this app's existing
-- word-bank-as-code convention for tamilGrammar/uyirEzhuthukkal).
--
-- This table stores only what a teacher's review/admin action can
-- realistically change at runtime, LAYERED on top of that static
-- content: whether a word is enabled, its reviewStatus, and an
-- optional corrected English/Tamil meaning. A missing row for a given
-- word_id means "use the static file's defaults" -- so seeding this
-- table is never required for the game to work.
-- =====================================================

CREATE TABLE sms_mayangoli_word_overrides (
  word_id TEXT PRIMARY KEY,
  review_status TEXT CHECK (review_status IN ('generated', 'reviewed', 'approved')),
  enabled BOOLEAN,
  meaning_english_override TEXT,
  meaning_tamil_override TEXT,
  reviewed_by UUID REFERENCES sms_teachers(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sms_mayangoli_word_overrides ENABLE ROW LEVEL SECURITY;

-- Any authenticated teacher can review/edit the shared word bank (it's
-- a shared teaching resource, not per-teacher content) -- same "any
-- teacher, not just an owner" model as e.g. sms_resources for shared
-- materials. Admins also have full access via sms_current_role().
CREATE POLICY "mayangoli_word_overrides: teachers manage" ON sms_mayangoli_word_overrides
  FOR ALL USING (
    sms_current_role() IN ('admin', 'teacher')
  )
  WITH CHECK (
    sms_current_role() IN ('admin', 'teacher')
  );

-- Students never read this table directly -- word content reaches them
-- only through generated MayangoliQuestion payloads (state/answer
-- routes), never a raw word-bank row.
