-- =====================================================
-- 035: FIX -- leaving 'pending' must replace it, not add to it
--
-- 031 enforced that a 'pending' account holds no other role, which is
-- correct as a statement about a half-onboarded account. But the grant
-- trigger only ever INSERTS, so the 'pending' grant created at sign-up
-- was never removed. The moment onboarding finished and
-- sms_profiles.role became 'parent', the trigger tried to add a 'parent'
-- grant next to the surviving 'pending' one, and the exclusivity rule
-- rejected the very transition it was meant to protect:
--
--   A pending account cannot hold any additional role
--
-- Symptom: /api/me/complete-profile and the admin approve route both
-- fail, leaving the account stranded at role='pending', is_active=false
-- with its profile row created but never activated. Confirmed against
-- production: a real sign-up sat at exactly that state. 2026-08-11.
--
-- 'pending' is a state an account LEAVES, not a role it accumulates, so
-- taking a real role now clears it first. The exclusivity rule is kept
-- as a backstop -- with the delete in place the two can no longer
-- coexist, and the rule still catches anything trying to create that
-- combination directly.
-- =====================================================

CREATE OR REPLACE FUNCTION sms_grant_role_on_profile_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Taking a real role ends onboarding: drop the 'pending' grant before
  -- adding the new one, so the combination check sees a clean slate.
  IF NEW.role <> 'pending' THEN
    DELETE FROM sms_profile_roles
    WHERE profile_id = NEW.id AND role = 'pending';
  END IF;

  INSERT INTO sms_profile_roles (profile_id, role)
  VALUES (NEW.id, NEW.role)
  ON CONFLICT (profile_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Repair anyone already stranded: a profile that has moved on to a real
-- role but still carries the leftover 'pending' grant.
DELETE FROM sms_profile_roles pr
WHERE pr.role = 'pending'
  AND EXISTS (
    SELECT 1 FROM sms_profiles p
    WHERE p.id = pr.profile_id AND p.role <> 'pending'
  );
