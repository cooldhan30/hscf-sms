-- Audio homework: a teacher can attach an audio clip to an assignment
-- (students listen to it on the assignment page) and ask for a photo of
-- the finished work as the submission.
--
-- The clip lives in the existing public 'resources' bucket (teacher
-- uploads, any type, own folder only -- see migration 043), so no new
-- bucket or storage policy is needed. The photo is stored like any other
-- submitted file (sms_submissions.file_url); the new 'photo' value in
-- allow_submission_types only changes what the student form shows.
--
-- Additive and re-runnable.

ALTER TABLE sms_assignments ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE sms_assignments ADD COLUMN IF NOT EXISTS audio_size BIGINT;
