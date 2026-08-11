-- =====================================================
-- ASSIGNMENT SUBMISSIONS + STORAGE + POINT-DECAY COLUMNS
-- =====================================================
-- Adds a student "turn in work" step that didn't exist before
-- (teachers previously entered grades with no submission record
-- at all). Submissions can carry free text, an uploaded file, and/or
-- a recorded audio clip, stored in a new private Storage bucket.
--
-- Also adds a per-assignment late-penalty rate. This is DISPLAY-ONLY:
-- the app computes and shows students a live "worth X now" preview,
-- but sms_grades.score is still entered by the teacher by hand, same
-- as today -- no trigger auto-clamps it. Deliberate scope cut vs.
-- fully automated grading, since the gradebook has no such automation
-- to hook into yet.
-- =====================================================

ALTER TABLE sms_assignments
  ADD COLUMN IF NOT EXISTS points_deduction_per_day NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allow_submission_types TEXT[] NOT NULL DEFAULT ARRAY['text','file','audio'];

-- =====================================================
-- SMS_SUBMISSIONS
-- One row per student per assignment (resubmission = update the
-- existing row), same shape as sms_grades' one-row-per-student
-- pattern.
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES sms_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES sms_students(id) ON DELETE CASCADE,
  content TEXT,
  file_url TEXT,
  audio_url TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_submissions_assignment ON sms_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_sms_submissions_student ON sms_submissions(student_id);

DROP TRIGGER IF EXISTS trg_sms_submissions_updated_at ON sms_submissions;
CREATE TRIGGER trg_sms_submissions_updated_at BEFORE UPDATE ON sms_submissions
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();

ALTER TABLE sms_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "submissions: admin all" ON sms_submissions
  FOR ALL USING (sms_current_role() = 'admin');

-- Teacher only views submissions for assignments they own; they don't
-- create/edit them (reuses the existing sms_teacher_owns_assignment
-- helper from 004, no new helper needed).
CREATE POLICY "submissions: teacher read own assignment" ON sms_submissions
  FOR SELECT USING (sms_teacher_owns_assignment(assignment_id));

CREATE POLICY "submissions: student manage own" ON sms_submissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_submissions.student_id AND s.profile_id = sms_current_user_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sms_students s WHERE s.id = sms_submissions.student_id AND s.profile_id = sms_current_user_id())
  );

-- Inline join, same convention as "grades: parent read child" in 004/014
-- rather than a new SECURITY DEFINER helper -- sms_students/sms_parents/
-- sms_student_parents don't have any policy that reads sms_submissions
-- back, so there's no recursion risk here.
CREATE POLICY "submissions: parent read child" ON sms_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_student_parents sp
      JOIN sms_parents p ON p.id = sp.parent_id
      WHERE sp.student_id = sms_submissions.student_id AND p.profile_id = sms_current_user_id()
    )
  );

-- =====================================================
-- STORAGE: private 'submissions' bucket
-- Path convention: {student_profile_id}/{assignment_id}/{filename}
-- (bucket_id is 'submissions' already, no need to repeat it in the path).
-- IMPORTANT: after running this migration, verify in the Supabase
-- dashboard (Storage) that the 'submissions' bucket shows as Private,
-- not Public.
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "submissions bucket: admin all" ON storage.objects
  FOR ALL USING (bucket_id = 'submissions' AND sms_current_role() = 'admin');

CREATE POLICY "submissions bucket: student manage own" ON storage.objects
  FOR ALL USING (bucket_id = 'submissions' AND (storage.foldername(name))[1] = sms_current_user_id())
  WITH CHECK (bucket_id = 'submissions' AND (storage.foldername(name))[1] = sms_current_user_id());

-- The [2] path segment is always an assignment UUID written by our own
-- upload code, so the cast is safe here (never touched by arbitrary
-- user input).
CREATE POLICY "submissions bucket: teacher read owned assignment" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'submissions' AND sms_teacher_owns_assignment(((storage.foldername(name))[2])::uuid)
  );

CREATE POLICY "submissions bucket: parent read child" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'submissions' AND EXISTS (
      SELECT 1 FROM sms_students s
      JOIN sms_student_parents sp ON sp.student_id = s.id
      JOIN sms_parents p ON p.id = sp.parent_id
      WHERE s.profile_id = (storage.foldername(name))[1] AND p.profile_id = sms_current_user_id()
    )
  );
