-- =====================================================
-- 070: GRADE AUDIO FEEDBACK
--
-- Teachers can currently only leave text feedback on a grade. Adds an
-- optional recorded-audio alternative/companion, reusing the exact same
-- record -> preview -> upload building blocks already proven for
-- student submissions (AudioRecorder, AudioPlayer, uploadFile,
-- /api/storage/upload-url) -- no new recording UI, just a new
-- destination for it.
--
-- New private bucket rather than reusing 'submissions': that bucket's
-- path convention keys folder [1] to the STUDENT's profile id (since
-- students own their own submissions), which doesn't fit a
-- teacher-authored file -- a clean new bucket with the teacher as
-- folder [1] owner is simpler than overloading that convention.
-- Path: {teacher_profile_id}/{assignment_id}/{filename}, same shape as
-- 'submissions' otherwise. Plain Supabase Storage (not B2): feedback
-- clips are teacher-authored, smaller and far less frequent than
-- student submissions, so there's no need for B2's scale here.
-- =====================================================

ALTER TABLE sms_grades
  ADD COLUMN IF NOT EXISTS audio_feedback_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_feedback_size BIGINT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('grade-feedback', 'grade-feedback', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "grade-feedback bucket: admin all" ON storage.objects
  FOR ALL USING (bucket_id = 'grade-feedback' AND sms_current_role() = 'admin');

-- The [1] path segment is the teacher's own profile id -- same
-- "own folder" ownership model as every other private bucket.
CREATE POLICY "grade-feedback bucket: teacher manage own" ON storage.objects
  FOR ALL USING (bucket_id = 'grade-feedback' AND (storage.foldername(name))[1] = sms_current_user_id())
  WITH CHECK (bucket_id = 'grade-feedback' AND (storage.foldername(name))[1] = sms_current_user_id());

-- The [2] path segment is always an assignment UUID written by our own
-- upload code (same convention/safety note as the 'submissions' bucket's
-- equivalent policy in 015) -- a student may read feedback audio on any
-- assignment they're the graded student for, regardless of who taught it,
-- since sms_grades.student_id (not the assignment's class) is the real
-- ownership boundary for a student's own grade.
CREATE POLICY "grade-feedback bucket: student read own grade" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'grade-feedback' AND EXISTS (
      SELECT 1 FROM sms_grades g
      JOIN sms_students s ON s.id = g.student_id
      WHERE g.audio_feedback_url = storage.objects.name AND s.profile_id = sms_current_user_id()
    )
  );

CREATE POLICY "grade-feedback bucket: parent read child" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'grade-feedback' AND EXISTS (
      SELECT 1 FROM sms_grades g
      JOIN sms_students s ON s.id = g.student_id
      JOIN sms_student_parents sp ON sp.student_id = s.id
      JOIN sms_parents p ON p.id = sp.parent_id
      WHERE g.audio_feedback_url = storage.objects.name AND p.profile_id = sms_current_user_id()
    )
  );
