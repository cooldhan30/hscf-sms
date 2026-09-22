-- =====================================================
-- 074: GAMEROOM V2 QUESTION SET BUILDER -- METADATA + VISIBILITY
--
-- Adds the teacher-facing metadata fields the Question Set Builder
-- needs (Tamil/English display titles, level, subject, topic,
-- difficulty, estimated duration, tags) plus a teacher-to-teacher
-- sharing dimension (`visibility`) distinct from the existing
-- `published` column.
--
-- `published` (073) already gates STUDENT visibility (a tester student
-- can only read a set once it's published). `visibility` is a SEPARATE
-- axis controlling TEACHER-to-teacher sharing/reuse -- a teacher
-- building content can keep it PRIVATE while drafting, share it
-- SCHOOL-wide once ready for colleagues to reuse, or mark it PUBLIC.
-- This app is single-school, so SCHOOL and PUBLIC behave identically
-- today (both grant read to every teacher) -- kept as two distinct
-- values anyway because the request specifies them as separate
-- options a teacher chooses between, and collapsing them into one
-- value would misrepresent the teacher's actual choice back to them.
--
-- ISOLATION: purely additive to sms_gamev2_question_sets (073) --
-- no other table (including any sms_game_* legacy table) is touched.
-- All new columns are nullable or have safe defaults, so every
-- existing row from 073 remains valid with zero backfill needed.
-- =====================================================

ALTER TABLE sms_gamev2_question_sets
  ADD COLUMN IF NOT EXISTS tamil_title TEXT,
  ADD COLUMN IF NOT EXISTS english_title TEXT,
  ADD COLUMN IF NOT EXISTS level TEXT,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes INT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PRIVATE', 'SCHOOL', 'PUBLIC'));

CREATE INDEX IF NOT EXISTS idx_sms_gamev2_question_sets_visibility ON sms_gamev2_question_sets(visibility);

-- A teacher can now also read (but not write) another teacher's set if
-- it's shared SCHOOL-wide or PUBLIC -- additive alongside 073's
-- "teacher manage own" (FOR ALL, still owner-only for INSERT/UPDATE/
-- DELETE) and "tester read published" (a different population: gated
-- students, not teachers) policies. Postgres RLS policies are OR'd
-- together, so this only ever WIDENS read access, never narrows what
-- 073 already granted.
CREATE POLICY "gamev2_question_sets: teacher read shared" ON sms_gamev2_question_sets
  FOR SELECT USING (
    sms_current_role() = 'teacher'
    AND visibility IN ('SCHOOL', 'PUBLIC')
  );

-- Mirrors the above for the questions table -- a teacher reading a
-- shared set's summary also needs to read its actual questions (e.g.
-- to preview it before reusing it).
CREATE POLICY "gamev2_questions: teacher read shared set" ON sms_gamev2_questions
  FOR SELECT USING (
    sms_current_role() = 'teacher'
    AND EXISTS (
      SELECT 1 FROM sms_gamev2_question_sets qs
      WHERE qs.id = sms_gamev2_questions.question_set_id AND qs.visibility IN ('SCHOOL', 'PUBLIC')
    )
  );
