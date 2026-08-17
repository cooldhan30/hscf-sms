-- =====================================================
-- 043: RESOURCES
--
-- Shared file library: teachers/admin upload materials (worksheets,
-- videos, audio, PDFs...), every signed-in user can browse and download.
-- A resource can be scoped to one class (class_id set) or visible to
-- everyone (class_id NULL, the "all classes" case) -- filtering by class
-- in the UI is purely a convenience view over this, not an access
-- restriction (see bucket privacy note below).
--
-- Public bucket, same shape as 027/029 (profile-pictures,
-- assignment-images): public read (a resource link isn't sensitive and
-- needs to render/download without a signed-URL round trip), write
-- restricted to the uploader's own folder. Path convention:
-- {profile_id}/{filename}, same as every other bucket.
--
-- Delete is scoped narrower than the other two: a teacher may only
-- delete/update their OWN resources (created_by), not any teacher's --
-- unlike assignment-images where "own class" is the boundary. Admin
-- bypasses this via the usual FOR ALL policy.
-- =====================================================

CREATE TABLE IF NOT EXISTS sms_resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES sms_classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_by TEXT REFERENCES sms_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_resources_class ON sms_resources(class_id);
CREATE INDEX IF NOT EXISTS idx_sms_resources_created_by ON sms_resources(created_by);

DROP TRIGGER IF EXISTS trg_sms_resources_updated_at ON sms_resources;
CREATE TRIGGER trg_sms_resources_updated_at BEFORE UPDATE ON sms_resources
  FOR EACH ROW EXECUTE FUNCTION sms_update_updated_at_column();

ALTER TABLE sms_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resources: admin all" ON sms_resources
  FOR ALL USING (sms_current_role() = 'admin');

-- Every signed-in user (any role) can browse the library -- students
-- need to see and download; there's no reason to hide the list from
-- parents either, given assignment images/announcements are similarly
-- open once a class relationship exists at all.
CREATE POLICY "resources: authenticated read" ON sms_resources
  FOR SELECT USING (sms_current_user_id() IS NOT NULL);

CREATE POLICY "resources: teacher insert" ON sms_resources
  FOR INSERT WITH CHECK (
    sms_current_role() = 'teacher' AND created_by = sms_current_user_id()
  );

CREATE POLICY "resources: teacher manage own" ON sms_resources
  FOR UPDATE USING (sms_current_role() = 'teacher' AND created_by = sms_current_user_id())
  WITH CHECK (sms_current_role() = 'teacher' AND created_by = sms_current_user_id());

CREATE POLICY "resources: teacher delete own" ON sms_resources
  FOR DELETE USING (sms_current_role() = 'teacher' AND created_by = sms_current_user_id());

INSERT INTO storage.buckets (id, name, public)
VALUES ('resources', 'resources', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "resources bucket: public read" ON storage.objects;
CREATE POLICY "resources bucket: public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'resources');

DROP POLICY IF EXISTS "resources bucket: owner manage own" ON storage.objects;
CREATE POLICY "resources bucket: owner manage own" ON storage.objects
  FOR ALL USING (bucket_id = 'resources' AND (storage.foldername(name))[1] = sms_current_user_id())
  WITH CHECK (bucket_id = 'resources' AND (storage.foldername(name))[1] = sms_current_user_id());

DROP POLICY IF EXISTS "resources bucket: admin all" ON storage.objects;
CREATE POLICY "resources bucket: admin all" ON storage.objects
  FOR ALL USING (bucket_id = 'resources' AND sms_current_role() = 'admin');
