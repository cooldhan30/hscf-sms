-- =====================================================
-- 094: GAMEROOM CLASSIC -- QUESTION LIBRARY (Phase 2)
--
-- A teacher's own reusable questions, topics and saved games for
-- GameRoom Classic (/gr-classic). Teachers write a question once and
-- reuse it in any game of a compatible type.
--
-- ISOLATION: purely additive. Creates only new sms_grc_* tables and two
-- new sms_grc_* functions. No existing table, column, function, policy
-- or row is changed (the legacy GameRoom's sms_game_* and GameRoom V2's
-- sms_gamev2_* tables are untouched). It only references
-- sms_profiles(id) and reuses the existing helpers sms_current_role(),
-- sms_current_user_id() and sms_update_updated_at_column().
--
-- Rollback (nothing else depends on these tables):
--   DROP TABLE sms_grc_game_questions, sms_grc_games, sms_grc_questions, sms_grc_categories;
--   DROP FUNCTION sms_grc_check_game_question(), sms_grc_save_game(UUID, TEXT, TEXT, UUID, TEXT, INT, UUID[]);
-- =====================================================

-- Topics. owner_id NULL = a starter topic every teacher sees.
CREATE TABLE IF NOT EXISTS sms_grc_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  owner_id TEXT REFERENCES sms_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sms_grc_categories_owner_name ON sms_grc_categories (COALESCE(owner_id, ''), lower(btrim(name)));

-- Questions. `payload` holds the kind-specific shape (validated by the
-- server in lib/grClassic/validateQuestion.ts):
--   choice: { "options": [2-4 strings], "answerIndex": n }
--   match:  { "pairs": [{ "left": s, "right": s }, ... 2-6] }
--   order:  { "unit": "letters" | "words", "answer": s, "hint"?: s }
-- `content_key` is a normalised fingerprint used to stop the same
-- question being saved (or imported) twice by the same teacher.
-- Questions are archived, never hard-deleted, so saved games keep working.
CREATE TABLE IF NOT EXISTS sms_grc_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id TEXT NOT NULL REFERENCES sms_profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('choice', 'match', 'order')),
  category_id UUID REFERENCES sms_grc_categories(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL CHECK (char_length(prompt) BETWEEN 1 AND 500),
  prompt_en TEXT CHECK (prompt_en IS NULL OR char_length(prompt_en) <= 500),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  explanation TEXT CHECK (explanation IS NULL OR char_length(explanation) <= 1000),
  difficulty TEXT NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  content_key TEXT NOT NULL,
  archived_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sms_grc_questions_owner ON sms_grc_questions(owner_id, kind) WHERE archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sms_grc_questions_owner_content ON sms_grc_questions(owner_id, content_key) WHERE archived_at IS NULL;

-- Saved games: a game type plus an ordered list of compatible questions.
CREATE TABLE IF NOT EXISTS sms_grc_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id TEXT NOT NULL REFERENCES sms_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  game_type TEXT NOT NULL CHECK (game_type IN ('quiz', 'match', 'word-builder')),
  category_id UUID REFERENCES sms_grc_categories(id) ON DELETE SET NULL,
  difficulty TEXT NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  live_seconds INT NOT NULL DEFAULT 20 CHECK (live_seconds IN (10, 20, 30, 60)),
  archived_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sms_grc_games_owner ON sms_grc_games(owner_id) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS sms_grc_game_questions (
  game_id UUID NOT NULL REFERENCES sms_grc_games(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES sms_grc_questions(id) ON DELETE CASCADE,
  position INT NOT NULL CHECK (position >= 0 AND position < 200),
  PRIMARY KEY (game_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_sms_grc_game_questions_question ON sms_grc_game_questions(question_id);

DROP TRIGGER IF EXISTS trg_sms_grc_questions_updated_at ON sms_grc_questions;
CREATE TRIGGER trg_sms_grc_questions_updated_at BEFORE UPDATE ON sms_grc_questions
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();
DROP TRIGGER IF EXISTS trg_sms_grc_games_updated_at ON sms_grc_games;
CREATE TRIGGER trg_sms_grc_games_updated_at BEFORE UPDATE ON sms_grc_games
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();

-- A game may only hold its owner's questions, and only of the kind its
-- game type plays (quiz <- choice, match <- match, word-builder <- order).
-- Runs as the caller, so RLS also applies to the lookups: a question the
-- caller can't see is treated as "not theirs".
CREATE OR REPLACE FUNCTION sms_grc_check_game_question()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_game sms_grc_games%ROWTYPE;
  v_question sms_grc_questions%ROWTYPE;
BEGIN
  SELECT * INTO v_game FROM sms_grc_games WHERE id = NEW.game_id;
  SELECT * INTO v_question FROM sms_grc_questions WHERE id = NEW.question_id;
  IF v_game.id IS NULL OR v_question.id IS NULL OR v_game.owner_id <> v_question.owner_id THEN
    RAISE EXCEPTION 'GameRoom Classic: a game can only use its own teacher''s questions';
  END IF;
  IF v_question.kind <> CASE v_game.game_type WHEN 'quiz' THEN 'choice' WHEN 'match' THEN 'match' ELSE 'order' END THEN
    RAISE EXCEPTION 'GameRoom Classic: this question type does not fit a % game', v_game.game_type;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_grc_game_questions_check ON sms_grc_game_questions;
CREATE TRIGGER trg_sms_grc_game_questions_check BEFORE INSERT OR UPDATE ON sms_grc_game_questions
  FOR EACH ROW EXECUTE FUNCTION sms_grc_check_game_question();

-- Save a game and its ordered questions in one step (all or nothing), so
-- a failed save can never leave a game with half its questions.
-- SECURITY INVOKER: runs with the caller's own rights, so RLS and the
-- check trigger above still decide what is allowed. A game's type can't
-- change after creation (its questions were chosen for that type).
CREATE OR REPLACE FUNCTION sms_grc_save_game(
  p_game_id UUID,
  p_title TEXT,
  p_game_type TEXT,
  p_category_id UUID,
  p_difficulty TEXT,
  p_live_seconds INT,
  p_question_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_question_ids IS NULL OR cardinality(p_question_ids) = 0 THEN
    RAISE EXCEPTION 'GameRoom Classic: a game needs at least one question';
  END IF;
  IF cardinality(p_question_ids) > 100 THEN
    RAISE EXCEPTION 'GameRoom Classic: a game can have at most 100 questions';
  END IF;

  IF p_game_id IS NULL THEN
    INSERT INTO sms_grc_games (owner_id, title, game_type, category_id, difficulty, live_seconds)
    VALUES (sms_current_user_id(), btrim(p_title), p_game_type, p_category_id, p_difficulty, p_live_seconds)
    RETURNING id INTO v_id;
  ELSE
    UPDATE sms_grc_games
    SET title = btrim(p_title), category_id = p_category_id, difficulty = p_difficulty, live_seconds = p_live_seconds
    WHERE id = p_game_id AND game_type = p_game_type AND archived_at IS NULL
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'GameRoom Classic: game not found';
    END IF;
    DELETE FROM sms_grc_game_questions WHERE game_id = v_id;
  END IF;

  INSERT INTO sms_grc_game_questions (game_id, question_id, position)
  SELECT v_id, t.question_id, (t.ord - 1)::INT
  FROM unnest(p_question_ids) WITH ORDINALITY AS t(question_id, ord);

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION sms_grc_save_game(UUID, TEXT, TEXT, UUID, TEXT, INT, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sms_grc_save_game(UUID, TEXT, TEXT, UUID, TEXT, INT, UUID[]) TO authenticated;

-- ---------- Row Level Security ----------
-- Phase 2 is teacher-only: a teacher reads and writes only their own
-- questions and games; admins can read everything. Students get no
-- access here -- they will play through server routes that never send
-- answer keys (Phases 4-6).
ALTER TABLE sms_grc_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_grc_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_grc_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_grc_game_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grc_categories: staff read starter and own" ON sms_grc_categories
  FOR SELECT USING (sms_current_role() IN ('teacher', 'admin') AND (owner_id IS NULL OR owner_id = sms_current_user_id()));
CREATE POLICY "grc_categories: teacher manage own" ON sms_grc_categories
  FOR ALL USING (sms_current_role() = 'teacher' AND owner_id = sms_current_user_id())
  WITH CHECK (sms_current_role() = 'teacher' AND owner_id = sms_current_user_id());

CREATE POLICY "grc_questions: teacher manage own" ON sms_grc_questions
  FOR ALL USING (sms_current_role() = 'teacher' AND owner_id = sms_current_user_id())
  WITH CHECK (sms_current_role() = 'teacher' AND owner_id = sms_current_user_id());
CREATE POLICY "grc_questions: admin read" ON sms_grc_questions
  FOR SELECT USING (sms_current_role() = 'admin');

CREATE POLICY "grc_games: teacher manage own" ON sms_grc_games
  FOR ALL USING (sms_current_role() = 'teacher' AND owner_id = sms_current_user_id())
  WITH CHECK (sms_current_role() = 'teacher' AND owner_id = sms_current_user_id());
CREATE POLICY "grc_games: admin read" ON sms_grc_games
  FOR SELECT USING (sms_current_role() = 'admin');

CREATE POLICY "grc_game_questions: teacher manage own games" ON sms_grc_game_questions
  FOR ALL USING (
    sms_current_role() = 'teacher'
    AND EXISTS (SELECT 1 FROM sms_grc_games g WHERE g.id = sms_grc_game_questions.game_id AND g.owner_id = sms_current_user_id())
  )
  WITH CHECK (
    sms_current_role() = 'teacher'
    AND EXISTS (SELECT 1 FROM sms_grc_games g WHERE g.id = sms_grc_game_questions.game_id AND g.owner_id = sms_current_user_id())
  );
CREATE POLICY "grc_game_questions: admin read" ON sms_grc_game_questions
  FOR SELECT USING (sms_current_role() = 'admin');

-- ---------- Starter topics ----------
INSERT INTO sms_grc_categories (name)
SELECT t.name
FROM unnest(ARRAY[
  'உயிர் எழுத்துக்கள்',
  'மெய் எழுத்துக்கள்',
  'உயிர்மெய் எழுத்துக்கள்',
  'குறில் / நெடில்',
  'வல்லினம் / மெல்லினம் / இடையினம்',
  'இன எழுத்துக்கள்',
  'பெயர்ச்சொல்',
  'பெயர்ச்சொல் வகைகள்',
  'பெயரெச்சம்',
  'வினைச்சொல்',
  'வினையெச்சம்',
  'வினைமுற்று',
  'திணை',
  'பால்',
  'எண்',
  'காலம்',
  'இடம்',
  'சொல் பொருள்',
  'வாக்கிய அமைப்பு'
]) AS t(name)
WHERE NOT EXISTS (
  SELECT 1 FROM sms_grc_categories c WHERE c.owner_id IS NULL AND lower(btrim(c.name)) = lower(btrim(t.name))
);
