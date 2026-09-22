-- =====================================================
-- 075: GAMEROOM V2 QUESTION SET LIBRARY -- FAVORITES, USAGE, LANGUAGE
--
-- Supports the Question Set Library's discovery features: Favorites,
-- Recently Used, a real (not fabricated) usage count, and a Language
-- filter. Purely additive -- one new column on
-- sms_gamev2_question_sets (073/074) and two new tables. No existing
-- sms_gamev2_* table structure changes, and (as with every GameRoom V2
-- migration so far) no legacy sms_game_* table is touched in any way.
--
-- HONESTY NOTE: no play-session engine exists yet (see
-- lib/gameRoomV2/README.md's foundation-phase scope) -- there is no
-- "played this set" event to count. "Usage count if available" is
-- interpreted literally: the two usage events that genuinely CAN be
-- tracked today are DUPLICATE and ASSIGN (a set attached to a class/
-- homework), both real actions the API already needs to perform for
-- other reasons. sms_gamev2_question_set_usage logs exactly those, and
-- nothing is ever fabricated to fill in a "plays" number that doesn't
-- exist -- the library UI shows the real duplicate+assign count, or
-- omits the stat entirely for a set with zero recorded usage.
-- =====================================================

-- Auto-detected at save time from the set's question prompts/titles
-- (see lib/gameRoomV2/domain/language.ts's detectLanguage()) -- not a
-- teacher-entered field, so it can't drift from what the content
-- actually contains. Denormalized onto the set (same rationale as
-- 073's question_types column) so the Library's Language filter is a
-- plain indexed WHERE clause, not a per-row scan of every question.
ALTER TABLE sms_gamev2_question_sets
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'english' CHECK (language IN ('tamil', 'english', 'mixed'));

CREATE INDEX IF NOT EXISTS idx_sms_gamev2_question_sets_language ON sms_gamev2_question_sets(language);

-- =====================================================
-- FAVORITES
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_gamev2_favorites (
  profile_id TEXT NOT NULL REFERENCES sms_profiles(id) ON DELETE CASCADE,
  question_set_id UUID NOT NULL REFERENCES sms_gamev2_question_sets(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, question_set_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_gamev2_favorites_set ON sms_gamev2_favorites(question_set_id);

ALTER TABLE sms_gamev2_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gamev2_favorites: admin all" ON sms_gamev2_favorites
  FOR ALL USING (sms_current_role() = 'admin');

-- A teacher manages only their own favorites list -- favoriting someone
-- else's set doesn't require owning it, just being able to READ it
-- (already governed by 073/074's policies on sms_gamev2_question_sets;
-- the FK above further guarantees a favorite can't reference a
-- nonexistent set).
CREATE POLICY "gamev2_favorites: teacher manage own" ON sms_gamev2_favorites
  FOR ALL USING (sms_current_role() = 'teacher' AND profile_id = sms_current_user_id())
  WITH CHECK (sms_current_role() = 'teacher' AND profile_id = sms_current_user_id());

-- =====================================================
-- USAGE LOG (drives both "Recently Used" and the real usage count)
--
-- One row per event. `action` is intentionally narrow -- only events
-- the app can genuinely observe today. Adding a real "played" event
-- later (once a play engine exists) is a matter of extending this
-- CHECK, not redesigning the table.
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_gamev2_question_set_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_set_id UUID NOT NULL REFERENCES sms_gamev2_question_sets(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES sms_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('DUPLICATE', 'ASSIGN', 'PREVIEW')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_gamev2_usage_set ON sms_gamev2_question_set_usage(question_set_id);
CREATE INDEX IF NOT EXISTS idx_sms_gamev2_usage_profile_created ON sms_gamev2_question_set_usage(profile_id, created_at DESC);

ALTER TABLE sms_gamev2_question_set_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gamev2_usage: admin all" ON sms_gamev2_question_set_usage
  FOR ALL USING (sms_current_role() = 'admin');

-- A teacher can log their own usage events (INSERT) and read their own
-- history (for "Recently Used") -- but reading the aggregate COUNT
-- across ALL teachers for the "Usage count" stat on someone else's
-- shared set requires a narrow SECURITY DEFINER RPC (below), the same
-- "bypass row-level RLS for one safe, scoped aggregate" idiom already
-- used by legacy GameRoom's sms_game_session_leaderboard.
CREATE POLICY "gamev2_usage: teacher manage own" ON sms_gamev2_question_set_usage
  FOR ALL USING (sms_current_role() = 'teacher' AND profile_id = sms_current_user_id())
  WITH CHECK (sms_current_role() = 'teacher' AND profile_id = sms_current_user_id());

-- Total DUPLICATE+ASSIGN events across every teacher for one set --
-- deliberately excludes PREVIEW (previewing isn't "using" content the
-- way duplicating or assigning it is) and deliberately a COUNT, not
-- raw rows, so this never exposes WHICH other teachers used a set,
-- only how many times.
CREATE OR REPLACE FUNCTION sms_gamev2_question_set_usage_count(p_question_set_id UUID)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT
  FROM sms_gamev2_question_set_usage
  WHERE question_set_id = p_question_set_id AND action IN ('DUPLICATE', 'ASSIGN');
$$;
