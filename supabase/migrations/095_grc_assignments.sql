-- =====================================================
-- 095: GAMEROOM CLASSIC -- TEACHER ASSIGNMENTS (Phase 4)
--
-- Teachers assign a saved game to one or more of their classes with a
-- due date. Students play it as an assignment; every answer is stored
-- and graded on the server.
--
-- ISOLATION: purely additive. Creates only new sms_grc_* tables and one
-- new sms_grc_* function. No existing table, column, function, policy or
-- row is changed. It references sms_profiles, sms_classes, sms_students
-- and the 094 sms_grc_games table, and reuses the existing helpers
-- sms_current_role(), sms_current_user_id(), sms_teacher_owns_class()
-- and sms_update_updated_at_column().
--
-- WHO CAN DO WHAT
--   Teachers: create and manage assignments for classes they teach
--     (sms_teacher_owns_class), and read the attempts on their own
--     assignments. They cannot write attempts or grades.
--   Students: no direct table access at all. They play through server
--     routes that check their class enrollment, never send answer keys,
--     and grade every answer on the server.
--   Admins: read everything.
--
-- Run the whole file in the Supabase SQL editor (nothing selected, then
-- Run). Safe to run more than once.
--
-- Rollback (nothing else depends on these tables):
--   DROP TABLE sms_grc_responses, sms_grc_attempts, sms_grc_attempt_grants,
--     sms_grc_assignment_content, sms_grc_assignment_classes, sms_grc_assignments;
--   DROP FUNCTION sms_grc_publish_assignment(UUID, TEXT, TEXT, UUID[], TIMESTAMPTZ, INT, INT, INT, BOOLEAN, BOOLEAN, TEXT, TEXT, JSONB, INT, INT);
-- =====================================================

-- One assignment. The game is copied (title, type and the full questions
-- in sms_grc_assignment_content) when it is published, so editing or
-- archiving the game later never changes what students play or how it
-- was graded.
CREATE TABLE IF NOT EXISTS sms_grc_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id TEXT NOT NULL REFERENCES sms_profiles(id) ON DELETE CASCADE,
  game_id UUID REFERENCES sms_grc_games(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  game_type TEXT NOT NULL CHECK (game_type IN ('quiz', 'match', 'word-builder')),
  due_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  max_attempts INT CHECK (max_attempts IS NULL OR max_attempts BETWEEN 1 AND 10),
  timer_minutes INT CHECK (timer_minutes IS NULL OR timer_minutes BETWEEN 1 AND 180),
  passing_percent INT CHECK (passing_percent IS NULL OR passing_percent BETWEEN 1 AND 100),
  randomize BOOLEAN NOT NULL DEFAULT true,
  allow_late BOOLEAN NOT NULL DEFAULT false,
  show_answers TEXT NOT NULL DEFAULT 'after-due' CHECK (show_answers IN ('after-due', 'after-submit', 'never')),
  score_policy TEXT NOT NULL DEFAULT 'best' CHECK (score_policy IN ('best', 'latest')),
  question_count INT NOT NULL CHECK (question_count BETWEEN 1 AND 100),
  total_units INT NOT NULL CHECK (total_units BETWEEN 1 AND 1000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sms_grc_assignments_owner ON sms_grc_assignments(owner_id, due_at);

CREATE TABLE IF NOT EXISTS sms_grc_assignment_classes (
  assignment_id UUID NOT NULL REFERENCES sms_grc_assignments(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES sms_classes(id) ON DELETE CASCADE,
  PRIMARY KEY (assignment_id, class_id)
);
CREATE INDEX IF NOT EXISTS idx_sms_grc_assignment_classes_class ON sms_grc_assignment_classes(class_id);

-- The frozen questions WITH answer keys. Only the owning teacher (and
-- the server) can read this table.
CREATE TABLE IF NOT EXISTS sms_grc_assignment_content (
  assignment_id UUID PRIMARY KEY REFERENCES sms_grc_assignments(id) ON DELETE CASCADE,
  questions JSONB NOT NULL CHECK (jsonb_typeof(questions) = 'array')
);

-- Extra attempts a teacher grants to one student.
CREATE TABLE IF NOT EXISTS sms_grc_attempt_grants (
  assignment_id UUID NOT NULL REFERENCES sms_grc_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  extra INT NOT NULL DEFAULT 0 CHECK (extra BETWEEN 0 AND 20),
  PRIMARY KEY (assignment_id, student_id)
);

-- One try at an assignment. `play` is the answer-free version of the
-- questions in the order this student sees them (fixed for the attempt,
-- so a student who reconnects sees the same layout).
CREATE TABLE IF NOT EXISTS sms_grc_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES sms_grc_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  attempt_no INT NOT NULL CHECK (attempt_no BETWEEN 1 AND 50),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted')),
  play JSONB NOT NULL CHECK (jsonb_typeof(play) = 'array'),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deadline_at TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  correct_units INT,
  total_units INT,
  percent INT CHECK (percent IS NULL OR percent BETWEEN 0 AND 100),
  late BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (assignment_id, student_id, attempt_no)
);
-- At most one unfinished attempt per student per assignment.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sms_grc_attempts_one_open ON sms_grc_attempts(assignment_id, student_id) WHERE status = 'in_progress';
CREATE INDEX IF NOT EXISTS idx_sms_grc_attempts_student ON sms_grc_attempts(student_id);

-- The answer a student gave to one question in one attempt, and how it
-- scored. Only the first answer to a question counts (matching keeps the
-- first pick for every item).
CREATE TABLE IF NOT EXISTS sms_grc_responses (
  attempt_id UUID NOT NULL REFERENCES sms_grc_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL,
  response JSONB NOT NULL,
  correct_units INT NOT NULL CHECK (correct_units >= 0),
  total_units INT NOT NULL CHECK (total_units >= 1),
  given TEXT NOT NULL DEFAULT '',
  done BOOLEAN NOT NULL DEFAULT true,
  answered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (attempt_id, question_id)
);

DROP TRIGGER IF EXISTS trg_sms_grc_assignments_updated_at ON sms_grc_assignments;
CREATE TRIGGER trg_sms_grc_assignments_updated_at BEFORE UPDATE ON sms_grc_assignments
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();

-- Publish an assignment in one step (all or nothing): the assignment, its
-- classes and the frozen questions. SECURITY INVOKER, so RLS decides:
-- the caller must be a teacher, and every class must be one they teach.
CREATE OR REPLACE FUNCTION sms_grc_publish_assignment(
  p_game_id UUID,
  p_title TEXT,
  p_game_type TEXT,
  p_class_ids UUID[],
  p_due_at TIMESTAMPTZ,
  p_max_attempts INT,
  p_timer_minutes INT,
  p_passing_percent INT,
  p_randomize BOOLEAN,
  p_allow_late BOOLEAN,
  p_show_answers TEXT,
  p_score_policy TEXT,
  p_questions JSONB,
  p_question_count INT,
  p_total_units INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_id UUID;
  v_class UUID;
BEGIN
  IF p_class_ids IS NULL OR cardinality(p_class_ids) = 0 THEN
    RAISE EXCEPTION 'GameRoom Classic: pick at least one class';
  END IF;
  FOREACH v_class IN ARRAY p_class_ids LOOP
    IF NOT sms_teacher_owns_class(v_class) THEN
      RAISE EXCEPTION 'GameRoom Classic: you can only assign games to your own classes';
    END IF;
  END LOOP;

  INSERT INTO sms_grc_assignments (owner_id, game_id, title, game_type, due_at, max_attempts, timer_minutes, passing_percent, randomize, allow_late, show_answers, score_policy, question_count, total_units)
  VALUES (sms_current_user_id(), p_game_id, btrim(p_title), p_game_type, p_due_at, p_max_attempts, p_timer_minutes, p_passing_percent, p_randomize, p_allow_late, p_show_answers, p_score_policy, p_question_count, p_total_units)
  RETURNING id INTO v_id;

  INSERT INTO sms_grc_assignment_classes (assignment_id, class_id)
  SELECT DISTINCT v_id, c FROM unnest(p_class_ids) AS c;

  INSERT INTO sms_grc_assignment_content (assignment_id, questions) VALUES (v_id, p_questions);
  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION sms_grc_publish_assignment(UUID, TEXT, TEXT, UUID[], TIMESTAMPTZ, INT, INT, INT, BOOLEAN, BOOLEAN, TEXT, TEXT, JSONB, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sms_grc_publish_assignment(UUID, TEXT, TEXT, UUID[], TIMESTAMPTZ, INT, INT, INT, BOOLEAN, BOOLEAN, TEXT, TEXT, JSONB, INT, INT) TO authenticated;

-- ---------- Row Level Security ----------
ALTER TABLE sms_grc_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_grc_assignment_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_grc_assignment_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_grc_attempt_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_grc_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_grc_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "grc_assignments: teacher manage own" ON sms_grc_assignments;
CREATE POLICY "grc_assignments: teacher manage own" ON sms_grc_assignments
  FOR ALL USING (sms_current_role() = 'teacher' AND owner_id = sms_current_user_id())
  WITH CHECK (sms_current_role() = 'teacher' AND owner_id = sms_current_user_id());
DROP POLICY IF EXISTS "grc_assignments: admin read" ON sms_grc_assignments;
CREATE POLICY "grc_assignments: admin read" ON sms_grc_assignments
  FOR SELECT USING (sms_current_role() = 'admin');

DROP POLICY IF EXISTS "grc_assignment_classes: teacher manage own" ON sms_grc_assignment_classes;
CREATE POLICY "grc_assignment_classes: teacher manage own" ON sms_grc_assignment_classes
  FOR ALL USING (
    sms_current_role() = 'teacher'
    AND EXISTS (SELECT 1 FROM sms_grc_assignments a WHERE a.id = sms_grc_assignment_classes.assignment_id AND a.owner_id = sms_current_user_id())
  )
  WITH CHECK (
    sms_current_role() = 'teacher'
    AND sms_teacher_owns_class(class_id)
    AND EXISTS (SELECT 1 FROM sms_grc_assignments a WHERE a.id = sms_grc_assignment_classes.assignment_id AND a.owner_id = sms_current_user_id())
  );
DROP POLICY IF EXISTS "grc_assignment_classes: admin read" ON sms_grc_assignment_classes;
CREATE POLICY "grc_assignment_classes: admin read" ON sms_grc_assignment_classes
  FOR SELECT USING (sms_current_role() = 'admin');

DROP POLICY IF EXISTS "grc_assignment_content: teacher manage own" ON sms_grc_assignment_content;
CREATE POLICY "grc_assignment_content: teacher manage own" ON sms_grc_assignment_content
  FOR ALL USING (
    sms_current_role() = 'teacher'
    AND EXISTS (SELECT 1 FROM sms_grc_assignments a WHERE a.id = sms_grc_assignment_content.assignment_id AND a.owner_id = sms_current_user_id())
  )
  WITH CHECK (
    sms_current_role() = 'teacher'
    AND EXISTS (SELECT 1 FROM sms_grc_assignments a WHERE a.id = sms_grc_assignment_content.assignment_id AND a.owner_id = sms_current_user_id())
  );
DROP POLICY IF EXISTS "grc_assignment_content: admin read" ON sms_grc_assignment_content;
CREATE POLICY "grc_assignment_content: admin read" ON sms_grc_assignment_content
  FOR SELECT USING (sms_current_role() = 'admin');

DROP POLICY IF EXISTS "grc_attempt_grants: teacher manage own" ON sms_grc_attempt_grants;
CREATE POLICY "grc_attempt_grants: teacher manage own" ON sms_grc_attempt_grants
  FOR ALL USING (
    sms_current_role() = 'teacher'
    AND EXISTS (SELECT 1 FROM sms_grc_assignments a WHERE a.id = sms_grc_attempt_grants.assignment_id AND a.owner_id = sms_current_user_id())
  )
  WITH CHECK (
    sms_current_role() = 'teacher'
    AND EXISTS (SELECT 1 FROM sms_grc_assignments a WHERE a.id = sms_grc_attempt_grants.assignment_id AND a.owner_id = sms_current_user_id())
  );
DROP POLICY IF EXISTS "grc_attempt_grants: admin read" ON sms_grc_attempt_grants;
CREATE POLICY "grc_attempt_grants: admin read" ON sms_grc_attempt_grants
  FOR SELECT USING (sms_current_role() = 'admin');

-- Attempts and responses: teachers READ the ones on their own assignments.
-- Nobody writes them except the server (service role).
DROP POLICY IF EXISTS "grc_attempts: teacher read own assignments" ON sms_grc_attempts;
CREATE POLICY "grc_attempts: teacher read own assignments" ON sms_grc_attempts
  FOR SELECT USING (
    sms_current_role() = 'teacher'
    AND EXISTS (SELECT 1 FROM sms_grc_assignments a WHERE a.id = sms_grc_attempts.assignment_id AND a.owner_id = sms_current_user_id())
  );
DROP POLICY IF EXISTS "grc_attempts: admin read" ON sms_grc_attempts;
CREATE POLICY "grc_attempts: admin read" ON sms_grc_attempts
  FOR SELECT USING (sms_current_role() = 'admin');

DROP POLICY IF EXISTS "grc_responses: teacher read own assignments" ON sms_grc_responses;
CREATE POLICY "grc_responses: teacher read own assignments" ON sms_grc_responses
  FOR SELECT USING (
    sms_current_role() = 'teacher'
    AND EXISTS (
      SELECT 1 FROM sms_grc_attempts t JOIN sms_grc_assignments a ON a.id = t.assignment_id
      WHERE t.id = sms_grc_responses.attempt_id AND a.owner_id = sms_current_user_id()
    )
  );
DROP POLICY IF EXISTS "grc_responses: admin read" ON sms_grc_responses;
CREATE POLICY "grc_responses: admin read" ON sms_grc_responses
  FOR SELECT USING (sms_current_role() = 'admin');
