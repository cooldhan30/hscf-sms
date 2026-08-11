-- =====================================================
-- ASSIGNMENT IMAGES
-- =====================================================
-- Lets a teacher attach one image to an assignment (a worksheet scan,
-- a diagram, a reference photo) that every enrolled student can see.
-- New public bucket, same shape as 027's profile-pictures: public read
-- (assignment images aren't sensitive and need to render for every
-- enrolled student without a signed-URL round trip), write restricted to
-- the uploading teacher's own folder. Path convention:
-- {profile_id}/{filename}, same as profile-pictures and submissions.
-- =====================================================

ALTER TABLE sms_assignments ADD COLUMN IF NOT EXISTS image_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('assignment-images', 'assignment-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "assignment images: public read" ON storage.objects;
CREATE POLICY "assignment images: public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'assignment-images');

DROP POLICY IF EXISTS "assignment images: owner manage own" ON storage.objects;
CREATE POLICY "assignment images: owner manage own" ON storage.objects
  FOR ALL USING (bucket_id = 'assignment-images' AND (storage.foldername(name))[1] = sms_current_user_id())
  WITH CHECK (bucket_id = 'assignment-images' AND (storage.foldername(name))[1] = sms_current_user_id());

DROP POLICY IF EXISTS "assignment images: admin all" ON storage.objects;
CREATE POLICY "assignment images: admin all" ON storage.objects
  FOR ALL USING (bucket_id = 'assignment-images' AND sms_current_role() = 'admin');
