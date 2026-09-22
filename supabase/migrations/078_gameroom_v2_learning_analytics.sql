-- =====================================================
-- 078: GAMEROOM V2 LEARNING ANALYTICS
--
-- Tracks EDUCATIONAL performance independently from GAME performance
-- (score/XP/coins, already covered by migrations 076-077). Nothing
-- here changes scoring, rewards, or the reward service's XP/coin math
-- -- this is a purely additional read model teachers use to see what a
-- student has actually learned, separate from how well they played.
--
-- METADATA GRANULARITY: confirmed via full codebase audit that ZERO
-- per-question metadata exists anywhere today (DB, API, or Builder UI)
-- -- subject/topic/tags/difficulty all live only on the parent question
-- SET (migration 074). The flagship analytics example ("7 students
-- repeatedly confused ண/ந/ன") needs concept-level granularity finer
-- than a whole set typically has, so this migration adds OPTIONAL
-- per-question dimension/concept metadata rather than only reusing
-- set-level tags. Both fields are nullable and additive -- every
-- existing question set continues to work exactly as before with no
-- per-question metadata at all; analytics simply has less granularity
-- for sets authored before this feature (see
-- lib/gameRoomV2/analytics/dimensions.ts's fallback-to-set-level
-- behavior for exactly how that degrades gracefully, never silently
-- fabricating a dimension/concept that wasn't actually asserted).
--
-- dimension is a plain TEXT CHECK against the 7 fixed learning
-- dimensions the request names (Reading/Vocabulary/Listening/Grammar/
-- Writing/Spelling/Comprehension) -- a small, stable enum worth a DB
-- constraint, unlike engine_id's "no FK to a code registry" idiom
-- elsewhere, since this genuinely never needs a migration-free registry
-- (a genuinely new 8th dimension is a curriculum decision, not a
-- feature-flag-style addition).
--
-- concept_tags is free-text TEXT[], not a constrained enum, since
-- Tamil grammar concepts (குறில்/நெடில், வல்லினம்/மெல்லினம்/இடையினம்,
-- மயங்கொலி, திணை, பால், எண், காலம், இடம், ...) are an open,
-- teacher-extensible vocabulary -- lib/gameRoomV2/analytics/concepts.ts
-- provides a starter catalog for Builder UI autocomplete, but a teacher
-- can tag a question with any concept string, mirroring how
-- sms_gamev2_question_sets.tags already works.
-- =====================================================
ALTER TABLE sms_gamev2_questions ADD COLUMN IF NOT EXISTS dimension TEXT
  CHECK (dimension IS NULL OR dimension IN ('reading', 'vocabulary', 'listening', 'grammar', 'writing', 'spelling', 'comprehension'));
ALTER TABLE sms_gamev2_questions ADD COLUMN IF NOT EXISTS concept_tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_sms_gamev2_questions_dimension ON sms_gamev2_questions(dimension) WHERE dimension IS NOT NULL;

-- =====================================================
-- LEARNING ANALYTICS EVENTS -- one row per answered question, replacing
-- the old blanket cross-product sms_gamev2_skill_practice wrote (one
-- row per answer PER set-level tag, all sharing the session's own
-- is_correct with zero per-question distinction). This table instead
-- denormalizes exactly the dimension/concepts/question_type/session
-- context a single answer actually has at answer time, one row per
-- answer -- never fanned out across tags, so aggregation later is a
-- straightforward GROUP BY rather than needing to first de-duplicate a
-- cross-product.
--
-- sms_gamev2_skill_practice itself is left untouched (no migration
-- drops it) since it's additive infrastructure from a prior phase with
-- its own RLS/indexes -- this is a NEW, better-shaped table alongside
-- it, not a replacement migration. Nothing currently reads
-- skill_practice (confirmed by audit), so there is no consumer to
-- migrate off of it; a future cleanup pass can retire it once
-- confirmed nothing depends on it.
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_gamev2_learning_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  answer_id UUID NOT NULL REFERENCES sms_gamev2_answers(id) ON DELETE CASCADE,
  question_set_id UUID NOT NULL REFERENCES sms_gamev2_question_sets(id) ON DELETE CASCADE,
  engine_id TEXT NOT NULL,
  question_type TEXT NOT NULL,
  -- Nullable: a question authored before this feature (or one whose
  -- teacher chose not to tag a dimension) has no dimension signal at
  -- all -- this row still exists (concept_tags may still be populated
  -- via the set-level fallback) but is excluded from dimension-specific
  -- rollups, never defaulted to a guessed dimension.
  dimension TEXT,
  concept_tags TEXT[] NOT NULL DEFAULT '{}',
  is_correct BOOLEAN NOT NULL,
  response_time_ms INT NOT NULL,
  -- Populated only for a WRONG single-answer-shaped response
  -- (MULTIPLE_CHOICE/TRUE_FALSE/IMAGE_CHOICE/AUDIO_CHOICE) where "the
  -- student picked X instead of the correct Y" is a meaningful single
  -- pairwise mistake -- see
  -- lib/gameRoomV2/analytics/confusionPairs.ts's extractConfusionPair()
  -- for exactly which types/shapes qualify. NULL for a correct answer,
  -- an open-ended/multi-part question type, or malformed data -- this
  -- is the concrete data source behind "7 students repeatedly confused
  -- ண/ந/ன"-style common-mistake reports.
  confusion_pair_key TEXT,
  answered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_gamev2_learning_events_student ON sms_gamev2_learning_events(student_id);
CREATE INDEX IF NOT EXISTS idx_sms_gamev2_learning_events_set ON sms_gamev2_learning_events(question_set_id);
CREATE INDEX IF NOT EXISTS idx_sms_gamev2_learning_events_dimension ON sms_gamev2_learning_events(dimension) WHERE dimension IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_gamev2_learning_events_confusion ON sms_gamev2_learning_events(confusion_pair_key) WHERE confusion_pair_key IS NOT NULL;
-- GIN index for "which students practiced concept X" / concept-confusion
-- queries that filter on concept_tags containment.
CREATE INDEX IF NOT EXISTS idx_sms_gamev2_learning_events_concepts ON sms_gamev2_learning_events USING GIN (concept_tags);

ALTER TABLE sms_gamev2_learning_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gamev2_learning_events: admin all" ON sms_gamev2_learning_events
  FOR ALL USING (sms_current_role() = 'admin');

-- Written exclusively by the reward service (SECURITY DEFINER-free --
-- this table's insert runs as the authenticated student, same posture
-- as sms_gamev2_skill_practice already has, since the values being
-- written are computed server-side from already-graded answers, not
-- client-supplied). Student can read their own for a personal
-- "practice more" surface (இன்றைய சவால் topic selection).
CREATE POLICY "gamev2_learning_events: student manage own" ON sms_gamev2_learning_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_gamev2_learning_events.student_id AND s.profile_id = sms_current_user_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_gamev2_learning_events.student_id AND s.profile_id = sms_current_user_id())
  );

-- The actual enforcement mechanism behind "teacher analytics": a
-- teacher can read learning events for any session played against a
-- Question Set THEY created -- the concrete data source for class
-- accuracy, topic mastery, students-needing-practice, and common-
-- mistake reports, scoped exactly the same way
-- "gamev2_answers: teacher read own set answers" already scopes raw
-- answers.
CREATE POLICY "gamev2_learning_events: teacher read own set events" ON sms_gamev2_learning_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_gamev2_question_sets qs
      WHERE qs.id = sms_gamev2_learning_events.question_set_id AND qs.created_by = sms_current_user_id()
    )
  );
