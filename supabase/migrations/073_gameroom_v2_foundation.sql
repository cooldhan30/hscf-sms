-- =====================================================
-- 073: GAMEROOM V2 FOUNDATION
--
-- GameRoom V2 is a ground-up rebuild that separates CONTENT (a
-- reusable "question set" a teacher authors once) from GAMEPLAY (a
-- swappable "game engine" that can play any compatible question set --
-- Classic Quiz today, Tower Defense/Boss Battle/Racing/Treasure Quest
-- later). This is a deliberate architectural break from legacy
-- GameRoom, where every module bundles its own hardcoded question bank
-- directly into the game engine (lib/gameRoom/modules/*) -- see
-- lib/gameRoomV2/README.md for the full rationale.
--
-- ISOLATION FROM PRODUCTION GAMEROOM (non-negotiable):
-- - No table, column, policy, or function created here touches
--   sms_game_sessions / sms_game_players / sms_game_answers, or any
--   other existing sms_* table, in any way. Every new object below is
--   entirely new and additive.
-- - sms_gamev2_* tables only ever REFERENCE sms_students/sms_teachers/
--   sms_classes by foreign key (read dependency) -- nothing here
--   writes to those tables or changes their RLS.
-- - A V2 question set/session can NEVER appear in
--   sms_game_room_alltime_leaderboard() (that RPC only ever reads
--   sms_game_players, which V2 never writes to) -- so V2 play can
--   never pollute production GameRoom's cross-session leaderboard.
--
-- SCOPE OF THIS MIGRATION: foundation only. This creates the content
-- model (question sets + questions) and the access-gate table used to
-- keep V2 invisible to normal students during development. It does
-- NOT create session/player/answer tables yet -- those come with the
-- first real playable engine, once the content model has been proven
-- out, per the phased plan in the GameRoom V2 discovery report.
-- =====================================================

-- =====================================================
-- ACCESS GATE
--
-- No feature-flag system exists anywhere in this codebase (confirmed
-- by repo-wide search). Rather than introduce new flag infrastructure
-- for a single soft-launch feature, this follows the same "data-gated
-- access, not a flag service" precedent already used by Tamil Theni
-- (sms_theni_enrollments) -- a signed-in user only gets past the V2
-- guard if a row for them exists here. Admins always pass regardless
-- of this table (see requireGameV2Access() in
-- lib/gameRoomV2/requireAccess.ts), so a developer/admin never needs
-- to be added here to test V2.
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_gamev2_testers (
  profile_id TEXT PRIMARY KEY REFERENCES sms_profiles(id) ON DELETE CASCADE,
  added_by TEXT REFERENCES sms_profiles(id),
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  notes TEXT
);

ALTER TABLE sms_gamev2_testers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gamev2_testers: admin all" ON sms_gamev2_testers
  FOR ALL USING (sms_current_role() = 'admin');

-- A user needs to be able to check their OWN row (so the client can
-- decide whether to even attempt loading V2), but never anyone else's.
CREATE POLICY "gamev2_testers: self read" ON sms_gamev2_testers
  FOR SELECT USING (profile_id = sms_current_user_id());

-- =====================================================
-- QUESTION SETS (the "CONTENT" half of the content/gameplay split)
--
-- A teacher authors a question set once (e.g. "திணை, பால், எண்,
-- காலம், இடம்"). It is NOT tied to any one game engine -- the engine
-- that plays it is chosen at session-creation time (future migration),
-- looked up via sms_gamev2_question_sets.compatible_question_types
-- against a game engine's declared compatibility (see
-- lib/gameRoomV2/engine.ts's GameEngineCompatibility). This table
-- intentionally has NO game_type/engine_id column -- that coupling is
-- exactly what legacy GameRoom's modules have today, and exactly what
-- V2 is designed to avoid.
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_gamev2_question_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  -- NULL = usable by any class/teacher (a shared/library set), same
  -- "NULL means everyone" convention already used by
  -- sms_resources.class_id (043_resources.sql).
  class_id UUID REFERENCES sms_classes(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL REFERENCES sms_profiles(id),
  -- Denormalized from the questions below (kept in sync by the API
  -- layer, not a trigger, matching the low-machinery style already
  -- used for e.g. sms_resources' free-form tags) so a "which engines
  -- can play this set" check doesn't require joining every question
  -- row just to list sets in a picker.
  question_types TEXT[] NOT NULL DEFAULT '{}',
  question_count INT NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_gamev2_question_sets_class ON sms_gamev2_question_sets(class_id);
CREATE INDEX IF NOT EXISTS idx_sms_gamev2_question_sets_created_by ON sms_gamev2_question_sets(created_by);

DROP TRIGGER IF EXISTS trg_sms_gamev2_question_sets_updated_at ON sms_gamev2_question_sets;
CREATE TRIGGER trg_sms_gamev2_question_sets_updated_at BEFORE UPDATE ON sms_gamev2_question_sets
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();

-- =====================================================
-- QUESTIONS
--
-- One row per question. `question_type` is intentionally a wide-open
-- CHECK list covering both the types V2 supports at launch and types
-- explicitly planned for later (PRONUNCIATION, READING_FLUENCY) per
-- the GameRoomQuestionType domain enum in
-- lib/gameRoomV2/domain/questionTypes.ts -- adding a genuinely NEW type
-- beyond this list still needs a migration (CHECK constraints can't be
-- extended by the app layer alone), but every type already anticipated
-- by the architecture is pre-declared so that day never comes for the
-- known roadmap.
--
-- `payload` (JSONB) holds the type-specific shape (options for
-- MULTIPLE_CHOICE, pairs for MATCH, blanks for FILL_BLANK, etc) --
-- deliberately NOT normalized into per-type columns/tables, since the
-- whole point of this table is to stay generic across question types
-- that don't exist yet. Validation of payload shape happens at the API
-- layer (lib/gameRoomV2/domain/questionTypes.ts), not via a DB CHECK.
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_gamev2_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_set_id UUID NOT NULL REFERENCES sms_gamev2_question_sets(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  question_type TEXT NOT NULL CHECK (question_type IN (
    'MULTIPLE_CHOICE', 'TRUE_FALSE', 'IMAGE_CHOICE', 'TEXT_INPUT',
    'FILL_BLANK', 'MATCH', 'ORDER_LETTERS', 'ORDER_WORDS',
    'CATEGORIZE', 'AUDIO_CHOICE', 'PRONUNCIATION', 'READING_FLUENCY'
  )),
  prompt TEXT NOT NULL,
  -- Type-specific data: e.g. MULTIPLE_CHOICE -> {options: string[],
  -- correctAnswer: string}; MATCH -> {pairs: {left, right}[]};
  -- CATEGORIZE -> {items: string[], categories: string[], answerKey:
  -- Record<item, category>}. See
  -- lib/gameRoomV2/domain/questionTypes.ts for the authoritative
  -- per-type TypeScript shapes this must satisfy.
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  explanation TEXT,
  media_url TEXT,
  points INT NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_gamev2_questions_set ON sms_gamev2_questions(question_set_id, sort_order);

DROP TRIGGER IF EXISTS trg_sms_gamev2_questions_updated_at ON sms_gamev2_questions;
CREATE TRIGGER trg_sms_gamev2_questions_updated_at BEFORE UPDATE ON sms_gamev2_questions
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();

ALTER TABLE sms_gamev2_question_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_gamev2_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gamev2_question_sets: admin all" ON sms_gamev2_question_sets
  FOR ALL USING (sms_current_role() = 'admin');

-- A teacher manages their own question sets. Unlike sms_resources
-- (where any teacher can edit any resource's taxonomy), a V2 question
-- set stays owner-or-admin only across the board while the feature is
-- still gated/experimental -- this can be relaxed later the same way
-- 049_resource_edit_any_teacher.sql relaxed sms_resources, once V2 is
-- further along.
CREATE POLICY "gamev2_question_sets: teacher manage own" ON sms_gamev2_question_sets
  FOR ALL USING (sms_current_role() = 'teacher' AND created_by = sms_current_user_id())
  WITH CHECK (sms_current_role() = 'teacher' AND created_by = sms_current_user_id());

-- A gated tester (see sms_gamev2_testers above) can READ published
-- question sets, so a pilot student's client can eventually list what
-- they're allowed to play -- write access stays teacher/admin only.
CREATE POLICY "gamev2_question_sets: tester read published" ON sms_gamev2_question_sets
  FOR SELECT USING (
    published = true
    AND EXISTS (SELECT 1 FROM sms_gamev2_testers t WHERE t.profile_id = sms_current_user_id())
  );

CREATE POLICY "gamev2_questions: admin all" ON sms_gamev2_questions
  FOR ALL USING (sms_current_role() = 'admin');

CREATE POLICY "gamev2_questions: teacher manage own set" ON sms_gamev2_questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sms_gamev2_question_sets qs
      WHERE qs.id = sms_gamev2_questions.question_set_id AND qs.created_by = sms_current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sms_gamev2_question_sets qs
      WHERE qs.id = sms_gamev2_questions.question_set_id AND qs.created_by = sms_current_user_id()
    )
  );

CREATE POLICY "gamev2_questions: tester read published set" ON sms_gamev2_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_gamev2_question_sets qs
      WHERE qs.id = sms_gamev2_questions.question_set_id
        AND qs.published = true
        AND EXISTS (SELECT 1 FROM sms_gamev2_testers t WHERE t.profile_id = sms_current_user_id())
    )
  );
