-- =====================================================
-- 031: MULTI-ROLE PROFILES (role switching)
--
-- A teacher at this school is often also a parent of a student here, and
-- an admin usually is too. Until now one profile meant one role, so
-- those people needed two logins.
--
-- DESIGN: sms_profiles.role keeps its exact current meaning at the
-- database level -- "the role this person is acting as right now" -- and
-- a new table records which roles they are ALLOWED to act as. Switching
-- is then a one-row update of sms_profiles.role.
--
-- This is deliberately the opposite of granting on the union of held
-- roles. 42 existing policies compare sms_current_role() to a literal;
-- rewriting all of them to a "holds any of" check would be a large,
-- risky change to every access rule in a system holding children's
-- records. Keying off the acting role instead leaves all 42 untouched,
-- and is also stricter: while acting as a parent you genuinely cannot
-- read admin data, rather than merely not being shown it.
--
-- The composite FK below is what makes that safe -- it is not possible
-- to be acting in a role you were never granted, even via a direct
-- database write.
-- =====================================================

-- -----------------------------------------------------
-- 1. Which roles a profile MAY act as
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS sms_profile_roles (
  profile_id TEXT NOT NULL REFERENCES sms_profiles(id) ON DELETE CASCADE,
  role sms_role NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  granted_by TEXT REFERENCES sms_profiles(id),
  PRIMARY KEY (profile_id, role)
);

CREATE INDEX IF NOT EXISTS idx_sms_profile_roles_profile ON sms_profile_roles(profile_id);

-- Backfill: everyone keeps exactly the role they have today.
INSERT INTO sms_profile_roles (profile_id, role)
SELECT id, role FROM sms_profiles
ON CONFLICT (profile_id, role) DO NOTHING;

-- -----------------------------------------------------
-- 2. Keep the grant table in step with sms_profiles.role
--
-- Every existing write path -- the Clerk webhook, admin approval,
-- self-serve complete-profile, role provisioning -- sets
-- sms_profiles.role directly and knows nothing about this table. Rather
-- than hunt down and change all of them (and have the next one added
-- silently break), this trigger grants the role as a side effect of
-- setting it. Those paths keep working untouched, and the FK added
-- below can never fire on them.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION sms_grant_role_on_profile_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO sms_profile_roles (profile_id, role)
  VALUES (NEW.id, NEW.role)
  ON CONFLICT (profile_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_profiles_grant_role ON sms_profiles;
CREATE TRIGGER trg_sms_profiles_grant_role
  BEFORE INSERT OR UPDATE OF role ON sms_profiles
  FOR EACH ROW EXECUTE FUNCTION sms_grant_role_on_profile_write();

-- -----------------------------------------------------
-- 3. You may only act as a role you hold
--
-- Enforced by the database, not by the UI or the API. A bug in either
-- must not be able to put someone in a role they were never granted.
-- -----------------------------------------------------
ALTER TABLE sms_profiles
  DROP CONSTRAINT IF EXISTS sms_profiles_acting_role_granted_fkey;

ALTER TABLE sms_profiles
  ADD CONSTRAINT sms_profiles_acting_role_granted_fkey
  FOREIGN KEY (id, role) REFERENCES sms_profile_roles(profile_id, role)
  DEFERRABLE INITIALLY DEFERRED;

-- -----------------------------------------------------
-- 4. Which combinations are legitimate
--
-- Students never gain a second role: a child must not be able to become
-- a teacher or a parent, and this is the rule most worth enforcing in
-- the database rather than trusting a form to withhold the option.
-- 'pending' is likewise exclusive -- it means onboarding is unfinished,
-- which cannot be true alongside a real role.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION sms_check_role_combination()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_existing sms_role[];
BEGIN
  SELECT ARRAY_AGG(role) INTO v_existing
  FROM sms_profile_roles
  WHERE profile_id = NEW.profile_id AND role <> NEW.role;

  IF v_existing IS NULL OR array_length(v_existing, 1) IS NULL THEN
    RETURN NEW; -- first role for this profile, nothing to conflict with
  END IF;

  IF NEW.role = 'student' OR 'student' = ANY(v_existing) THEN
    RAISE EXCEPTION 'A student account cannot hold any additional role';
  END IF;

  IF NEW.role = 'pending' OR 'pending' = ANY(v_existing) THEN
    RAISE EXCEPTION 'A pending account cannot hold any additional role';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_profile_roles_combination ON sms_profile_roles;
CREATE TRIGGER trg_sms_profile_roles_combination
  BEFORE INSERT OR UPDATE ON sms_profile_roles
  FOR EACH ROW EXECUTE FUNCTION sms_check_role_combination();

-- -----------------------------------------------------
-- 5. Switching
--
-- SECURITY DEFINER so it can update sms_profiles.role, but it derives
-- the caller from the session rather than taking a profile id -- there
-- is no argument here that would let one user switch another user's
-- role.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION sms_switch_active_role(p_role sms_role)
RETURNS sms_role
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user TEXT := sms_current_user_id();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM sms_profile_roles WHERE profile_id = v_user AND role = p_role
  ) THEN
    RAISE EXCEPTION 'You do not have access to the % portal', p_role;
  END IF;

  UPDATE sms_profiles SET role = p_role, updated_at = NOW() WHERE id = v_user;

  RETURN p_role;
END;
$$;

-- -----------------------------------------------------
-- 6. Visibility
-- -----------------------------------------------------
ALTER TABLE sms_profile_roles ENABLE ROW LEVEL SECURITY;

-- Everyone can see which portals they themselves may switch into --
-- the switcher in Settings needs this, in whichever role they are
-- currently acting as.
DROP POLICY IF EXISTS "profile_roles: read own" ON sms_profile_roles;
CREATE POLICY "profile_roles: read own" ON sms_profile_roles
  FOR SELECT USING (profile_id = sms_current_user_id());

DROP POLICY IF EXISTS "profile_roles: admin all" ON sms_profile_roles;
CREATE POLICY "profile_roles: admin all" ON sms_profile_roles
  FOR ALL USING (sms_current_role() = 'admin');

-- Granting is never a direct client write -- it goes through the guarded
-- API routes, which apply the "no self-granting admin or teacher" rule.
REVOKE ALL ON FUNCTION sms_switch_active_role(sms_role) FROM anon;
