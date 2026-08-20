-- =====================================================
-- 050: TAMIL THENI -- CORE DOMAIN (Phase 1)
--
-- Tamil Theni is a separate, self-contained learning track (a national
-- vocabulary competition prep program), not a regular class -- it has
-- no single owning teacher, spans every grade level, and repeats every
-- year with a fresh word list. Modeling it as a new domain (its own
-- tables) rather than overloading sms_classes with a course_type
-- discriminator, because the two have almost nothing in common beyond
-- "a student can join something with a code": no schedule/room/single
-- teacher, enrollment is instant self-join (no approval gate -- there's
-- no single teacher to approve against), and it needs a season concept
-- regular classes don't have. Bolting that onto sms_classes would mean
-- a pile of nullable columns that only ever apply to one course_type.
--
-- Reused from the existing class join-code system (022): the same
-- unambiguous-alphabet code generator, and the same
-- SECURITY DEFINER narrow-lookup-by-code idiom (so a student who isn't
-- enrolled yet can still resolve a code without needing RLS read access
-- to the season row itself).
--
-- Entities:
--   sms_theni_seasons     -- "Tamil Theni 2026", one active at a time
--   sms_theni_levels      -- Theni 1..5 within a season (fixed 1-5, but
--                             modeled as rows, not a CHECK(1-5), so a
--                             future season could in principle differ)
--   sms_theni_categories  -- "1 - Body Parts" etc, scoped to a season
--   sms_theni_words       -- the ~800-word vocabulary, scoped to a
--                             category, with the 7-D1-3 style identity
--                             preserved as an explicit column (word_index)
--                             rather than relying on row order
--   sms_theni_enrollments -- student <-> season, instant self-join by code
--   sms_theni_word_progress -- per-student mastery tracking (Phase 2 will
--                             read/write this; created now so the schema
--                             doesn't need a second migration once the
--                             learning UI lands)
-- =====================================================

-- =====================================================
-- 1. Seasons
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_theni_seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,                    -- "Tamil Theni 2026"
  year INTEGER NOT NULL,
  join_code TEXT UNIQUE DEFAULT sms_generate_join_code(),
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- At most one active season at a time -- mirrors sms_academic_years'
-- is_current partial unique index, same reasoning: unambiguous "the
-- current one" without a separate settings row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_theni_seasons_one_active
  ON sms_theni_seasons(is_active) WHERE is_active;

DROP TRIGGER IF EXISTS trg_sms_theni_seasons_updated_at ON sms_theni_seasons;
CREATE TRIGGER trg_sms_theni_seasons_updated_at BEFORE UPDATE ON sms_theni_seasons
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();

-- Read-only lookup by code -- same shape as sms_resolve_class_by_join_code
-- (022): lets a not-yet-enrolled student resolve a season by code
-- without needing SELECT access to the row under normal RLS.
CREATE OR REPLACE FUNCTION sms_resolve_theni_season_by_join_code(p_code TEXT)
RETURNS TABLE (season_id UUID, season_name TEXT, is_active BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, sms_theni_seasons.is_active
  FROM sms_theni_seasons
  WHERE join_code = p_code;
$$;

-- =====================================================
-- 2. Levels (Theni 1..5 within a season)
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_theni_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id UUID NOT NULL REFERENCES sms_theni_seasons(id) ON DELETE CASCADE,
  level_number INTEGER NOT NULL CHECK (level_number BETWEEN 1 AND 5),
  name_tamil TEXT NOT NULL,       -- "அரும்பு"
  name_english TEXT,              -- optional gloss, not every level needs one
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (season_id, level_number)
);

-- =====================================================
-- 3. Categories (scoped to a season, since categories genuinely change
--    year to year -- e.g. 2026 added "Grammar" and "Roadways" as new)
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_theni_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id UUID NOT NULL REFERENCES sms_theni_seasons(id) ON DELETE CASCADE,
  category_number INTEGER NOT NULL,     -- the "1" in "1 - Body Parts" (word list's own numbering, not row order)
  name_english TEXT NOT NULL,
  name_tamil TEXT NOT NULL,
  icon TEXT,                            -- emoji or icon key for the "world" UI (Phase 3), nullable for now
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (season_id, category_number)
);

-- =====================================================
-- 4. Words -- the actual vocabulary
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_theni_words (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id UUID NOT NULL REFERENCES sms_theni_seasons(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES sms_theni_categories(id) ON DELETE CASCADE,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('D1', 'D2', 'D3')),
  word_index INTEGER NOT NULL,          -- the "3" in "7-D1-3" -- explicit, not row position
  english TEXT NOT NULL,
  tamil TEXT NOT NULL,
  alternate_tamil TEXT[] NOT NULL DEFAULT '{}',
  pronunciation TEXT,
  image_url TEXT,
  audio_url TEXT,
  example_sentence_tamil TEXT,
  example_sentence_english TEXT,
  hints TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  -- Preserves the word list's own unique identity format (category-difficulty-index,
  -- e.g. 7-D1-3) as a real constraint rather than just documentation.
  UNIQUE (category_id, difficulty, word_index)
);

CREATE INDEX IF NOT EXISTS idx_sms_theni_words_category ON sms_theni_words(category_id);
CREATE INDEX IF NOT EXISTS idx_sms_theni_words_season ON sms_theni_words(season_id);

DROP TRIGGER IF EXISTS trg_sms_theni_words_updated_at ON sms_theni_words;
CREATE TRIGGER trg_sms_theni_words_updated_at BEFORE UPDATE ON sms_theni_words
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();

-- =====================================================
-- 5. Enrollment -- instant self-join by code, no approval gate.
--    Unlike sms_class_join_requests, there's no single teacher who owns
--    a season to approve against, and gatekeeping a national vocabulary
--    prep program the school wants every student in serves no purpose
--    -- so this is a direct insert, not a pending/approved/denied flow.
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_theni_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id UUID NOT NULL REFERENCES sms_theni_seasons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  level_id UUID REFERENCES sms_theni_levels(id) ON DELETE SET NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  xp INTEGER NOT NULL DEFAULT 0,
  current_streak_days INTEGER NOT NULL DEFAULT 0,
  longest_streak_days INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  UNIQUE (season_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_theni_enrollments_student ON sms_theni_enrollments(student_id);

-- =====================================================
-- 6. Per-student word mastery (Phase 2 reads/writes this; created now
--    so Phase 2 doesn't need its own migration for the core loop).
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_theni_word_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID NOT NULL REFERENCES sms_theni_enrollments(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES sms_theni_words(id) ON DELETE CASCADE,
  exposure_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  mastery_score NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'learning', 'practicing', 'mastered', 'needs_review')),
  last_practiced_at TIMESTAMP WITH TIME ZONE,
  next_review_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (enrollment_id, word_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_theni_word_progress_enrollment ON sms_theni_word_progress(enrollment_id);

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE sms_theni_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_theni_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_theni_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_theni_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_theni_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_theni_word_progress ENABLE ROW LEVEL SECURITY;

-- Admin manages everything.
CREATE POLICY "theni_seasons: admin all" ON sms_theni_seasons FOR ALL USING (sms_current_role() = 'admin');
CREATE POLICY "theni_levels: admin all" ON sms_theni_levels FOR ALL USING (sms_current_role() = 'admin');
CREATE POLICY "theni_categories: admin all" ON sms_theni_categories FOR ALL USING (sms_current_role() = 'admin');
CREATE POLICY "theni_words: admin all" ON sms_theni_words FOR ALL USING (sms_current_role() = 'admin');
CREATE POLICY "theni_enrollments: admin all" ON sms_theni_enrollments FOR ALL USING (sms_current_role() = 'admin');
CREATE POLICY "theni_word_progress: admin all" ON sms_theni_word_progress FOR ALL USING (sms_current_role() = 'admin');

-- Any authenticated user can browse season/level/category/word content
-- once it's public curriculum data -- same "authenticated read" openness
-- as sms_resources (043). The sidebar/dashboard itself is what actually
-- gates a student's access by enrollment, not row-level secrecy of the
-- word list.
CREATE POLICY "theni_seasons: authenticated read" ON sms_theni_seasons FOR SELECT USING (sms_current_user_id() IS NOT NULL);
CREATE POLICY "theni_levels: authenticated read" ON sms_theni_levels FOR SELECT USING (sms_current_user_id() IS NOT NULL);
CREATE POLICY "theni_categories: authenticated read" ON sms_theni_categories FOR SELECT USING (sms_current_user_id() IS NOT NULL);
CREATE POLICY "theni_words: authenticated read" ON sms_theni_words FOR SELECT USING (sms_current_user_id() IS NOT NULL);

-- Enrollments: a student manages only their own.
CREATE POLICY "theni_enrollments: student read own" ON sms_theni_enrollments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_theni_enrollments.student_id AND s.profile_id = sms_current_user_id())
  );

CREATE POLICY "theni_enrollments: student insert own" ON sms_theni_enrollments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_theni_enrollments.student_id AND s.profile_id = sms_current_user_id())
  );

CREATE POLICY "theni_enrollments: student update own" ON sms_theni_enrollments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_theni_enrollments.student_id AND s.profile_id = sms_current_user_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_theni_enrollments.student_id AND s.profile_id = sms_current_user_id())
  );

-- A student can't reassign their enrollment to a different season/student
-- once created (that would effectively let them impersonate another
-- student's progress or hop seasons without going through the join flow).
REVOKE UPDATE (season_id, student_id) ON sms_theni_enrollments FROM authenticated;

-- Word progress: readable/writable only via the student's own enrollment.
CREATE POLICY "theni_word_progress: student manage own" ON sms_theni_word_progress
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sms_theni_enrollments e
      JOIN sms_students s ON s.id = e.student_id
      WHERE e.id = sms_theni_word_progress.enrollment_id AND s.profile_id = sms_current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sms_theni_enrollments e
      JOIN sms_students s ON s.id = e.student_id
      WHERE e.id = sms_theni_word_progress.enrollment_id AND s.profile_id = sms_current_user_id()
    )
  );

-- Teachers can read (not write) enrollment + progress for Phase 6
-- analytics -- broad read, not scoped to "their own class students",
-- since Tamil Theni has no single owning teacher the way a regular
-- class does. Narrowing this later (e.g. to teachers of a specific
-- Theni group) is a follow-up once that grouping concept exists.
CREATE POLICY "theni_enrollments: teacher read" ON sms_theni_enrollments
  FOR SELECT USING (sms_current_role() = 'teacher');

CREATE POLICY "theni_word_progress: teacher read" ON sms_theni_word_progress
  FOR SELECT USING (sms_current_role() = 'teacher');
