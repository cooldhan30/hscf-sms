-- =====================================================
-- AVATAR (PROFILE PICTURE) UPLOADS
-- =====================================================
-- Reuses the 'profile-pictures' bucket (already present from an earlier
-- app sharing this Supabase project) but with FRESH policies -- the old
-- ones on this bucket called Supabase's native auth.uid(), which throws
-- under Clerk auth (Clerk's user ids aren't valid uuids) and were
-- already dropped separately. Public read (avatars are shown throughout
-- the UI -- nav bar, chat, admin lists -- and aren't sensitive), write
-- restricted to the owning profile.
-- Path convention: {profile_id}/{filename}, same as the submissions
-- bucket in 015.
-- =====================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "avatars: public read" ON storage.objects;
CREATE POLICY "avatars: public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-pictures');

DROP POLICY IF EXISTS "avatars: owner manage own" ON storage.objects;
CREATE POLICY "avatars: owner manage own" ON storage.objects
  FOR ALL USING (bucket_id = 'profile-pictures' AND (storage.foldername(name))[1] = sms_current_user_id())
  WITH CHECK (bucket_id = 'profile-pictures' AND (storage.foldername(name))[1] = sms_current_user_id());

DROP POLICY IF EXISTS "avatars: admin all" ON storage.objects;
CREATE POLICY "avatars: admin all" ON storage.objects
  FOR ALL USING (bucket_id = 'profile-pictures' AND sms_current_role() = 'admin');
