-- =====================================================
-- 045: TRACK ASSIGNMENT IMAGE SIZE
--
-- sms_resources.file_size is captured at upload time (038), but
-- assignment images never got the same treatment -- there was no admin
-- view that needed it. The new admin/assignments page needs to sort by
-- size to find what's actually worth deleting for storage space, so
-- this adds the column going forward. Existing rows stay NULL (shown as
-- "unknown" in the UI) rather than backfilled -- that would mean
-- listing the whole assignment-images bucket, matching sizes back to
-- rows with no shared key (image_url is a public URL, not a stored
-- path), which is much more machinery than a one-time migration
-- justifies.
-- =====================================================

ALTER TABLE sms_assignments ADD COLUMN IF NOT EXISTS image_size BIGINT;
