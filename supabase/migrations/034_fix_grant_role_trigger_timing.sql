-- =====================================================
-- 034: FIX -- role-grant trigger must fire AFTER, not BEFORE
--
-- 031 created trg_sms_profiles_grant_role as BEFORE INSERT OR UPDATE.
-- On UPDATE that is harmless, because the sms_profiles row already
-- exists. On INSERT it is broken: the trigger inserts into
-- sms_profile_roles, whose profile_id references sms_profiles(id), while
-- the profile row itself has not been written yet. Postgres rejects it:
--
--   insert or update on table "sms_profile_roles" violates foreign key
--   constraint "sms_profile_roles_profile_id_fkey"
--
-- Every path that creates a profile hits this -- the Clerk webhook on
-- user.created, and /api/me/complete-profile -- so no new account could
-- finish onboarding. Confirmed against production: a real sign-up failed
-- on the "One More Step" screen. 2026-08-11.
--
-- AFTER is safe precisely because 031's composite FK on
-- sms_profiles(id, role) is DEFERRABLE INITIALLY DEFERRED: it is not
-- checked until commit, so the ordering within the transaction is
-- profile row -> grant row -> constraint check, and all three succeed.
-- The BEFORE timing was chosen to guarantee the grant existed before
-- that check, which the deferral already guarantees on its own.
-- =====================================================

DROP TRIGGER IF EXISTS trg_sms_profiles_grant_role ON sms_profiles;
CREATE TRIGGER trg_sms_profiles_grant_role
  AFTER INSERT OR UPDATE OF role ON sms_profiles
  FOR EACH ROW EXECUTE FUNCTION sms_grant_role_on_profile_write();

-- Repair anyone created while the trigger was broken, plus any profile
-- that predates 031's backfill. Without a grant row the composite FK
-- would reject the next write to their profile.
INSERT INTO sms_profile_roles (profile_id, role)
SELECT id, role FROM sms_profiles
ON CONFLICT (profile_id, role) DO NOTHING;
