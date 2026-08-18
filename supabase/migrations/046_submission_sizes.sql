-- =====================================================
-- 046: TRACK SUBMISSION FILE/AUDIO SIZES
--
-- Same reasoning as 038 (sms_resources.file_size) and 045
-- (sms_assignments.image_size) -- there was no admin view that needed
-- byte counts for submissions until now. Captured at upload time going
-- forward; existing rows stay NULL ("--" in the UI).
-- =====================================================

ALTER TABLE sms_submissions ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE sms_submissions ADD COLUMN IF NOT EXISTS audio_size BIGINT;
