-- =====================================================
-- FIX: parents had no policy allowing them to UPDATE their
-- own sms_parents row (same gap fixed for sms_teachers in
-- migration 007). Needed because sms_parents.phone is a
-- separate denormalized field from sms_profiles.phone that
-- admin/teacher UIs actually display -- the profile self-edit
-- route keeps both in sync, so it needs to be able to write
-- both.
-- =====================================================

CREATE POLICY "parents: self update" ON sms_parents
  FOR UPDATE USING (profile_id = auth.uid());

REVOKE UPDATE ON sms_parents FROM authenticated, anon;
GRANT UPDATE (phone) ON sms_parents TO authenticated;
