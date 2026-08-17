-- =====================================================
-- 040: STORAGE PROVIDER PER SUBMISSION
--
-- Submission uploads (file + audio) can now land on Backblaze B2 instead
-- of Supabase Storage's 'submissions' bucket -- see lib/storage/b2.ts and
-- app/api/storage/{upload-url,read-url}/route.ts. This column records
-- which provider a given row's file_url/audio_url actually live on, so
-- the read side knows whether to mint a Supabase signed URL or a B2
-- presigned URL. Existing rows default to 'supabase', which is correct:
-- everything written before this migration is on Supabase.
-- =====================================================

ALTER TABLE sms_submissions
  ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'supabase';

ALTER TABLE sms_submissions DROP CONSTRAINT IF EXISTS sms_submissions_storage_provider_check;
ALTER TABLE sms_submissions
  ADD CONSTRAINT sms_submissions_storage_provider_check CHECK (storage_provider IN ('supabase', 'b2'));
