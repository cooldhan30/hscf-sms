-- =====================================================
-- FIX: migration 004/007's column-level REVOKE UPDATE was a
-- no-op
-- =====================================================
-- Postgres tracks table-level and column-level privileges
-- separately. 'authenticated' held UPDATE at the TABLE level
-- (from Supabase's default privilege setup on new tables), so
-- "REVOKE UPDATE (role, is_active, email) ... FROM authenticated"
-- only ever touched a column-level grant that didn't exist --
-- it left the broader table-level grant fully intact. Confirmed
-- live: a teacher was able to PATCH their own profile's role to
-- 'admin' via a raw REST call after migration 004 supposedly
-- blocked it.
--
-- Real fix: revoke the table-level UPDATE entirely, then grant
-- back only the specific columns each self-edit flow actually
-- needs. Admin's own privileged updates to role/is_active/
-- employee_id already go through the service-role client
-- (which bypasses grants entirely), so narrowing here doesn't
-- break Phase 2.
-- =====================================================

REVOKE UPDATE ON sms_profiles FROM authenticated, anon;
GRANT UPDATE (first_name, last_name, phone, avatar_url) ON sms_profiles TO authenticated;

REVOKE UPDATE ON sms_teachers FROM authenticated, anon;
GRANT UPDATE (subject_specialty, bio) ON sms_teachers TO authenticated;
