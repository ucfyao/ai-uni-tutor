-- Migration: Institution Management System
-- Adds institution support parallel to the existing agent system.
-- Includes tables, RLS policies, and SECURITY DEFINER RPCs.

-- ===== A) Extend profiles role to include institution_admin =====

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'admin', 'super_admin', 'agent', 'institution_admin'));

-- ===== B) institutions table =====

CREATE TABLE institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  admin_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  commission_rate numeric NOT NULL DEFAULT 0.20
    CHECK (commission_rate >= 0 AND commission_rate <= 0.5),
  contact_info jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_institutions_admin ON institutions(admin_id);
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Institution admins can view own institution" ON institutions
  FOR SELECT USING ((SELECT auth.uid()) = admin_id);
CREATE POLICY "Admins can view all institutions" ON institutions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin')
  ));
CREATE POLICY "Admins can update institutions" ON institutions
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin')
  ));

-- ===== C) institution_members table =====

CREATE TABLE institution_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'removed')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz,
  UNIQUE(institution_id, user_id)
);

CREATE INDEX idx_institution_members_user ON institution_members(user_id);
CREATE INDEX idx_institution_members_institution ON institution_members(institution_id);
ALTER TABLE institution_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own membership" ON institution_members
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Institution admins can view their members" ON institution_members
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM institutions WHERE id = institution_id AND admin_id = (SELECT auth.uid())
  ));
CREATE POLICY "Admins can view all members" ON institution_members
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin')
  ));

-- ===== D) institution_invites table =====

CREATE TABLE institution_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  invite_code varchar(50) NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES profiles(id),
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_institution_invites_code ON institution_invites(invite_code);
CREATE INDEX idx_institution_invites_institution ON institution_invites(institution_id);
ALTER TABLE institution_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Institution admins can manage own invites" ON institution_invites
  FOR ALL USING (EXISTS (
    SELECT 1 FROM institutions WHERE id = institution_id AND admin_id = (SELECT auth.uid())
  ));
CREATE POLICY "Anyone can read invite by code" ON institution_invites
  FOR SELECT USING (true);

-- ===== E) Add institution_id to referral_codes =====

ALTER TABLE referral_codes ADD COLUMN institution_id uuid REFERENCES institutions(id);
CREATE INDEX idx_referral_codes_institution ON referral_codes(institution_id)
  WHERE institution_id IS NOT NULL;

-- ===== F) SECURITY DEFINER RPCs =====

-- F1: create_institution -- platform admin creates an institution and promotes the admin user
CREATE OR REPLACE FUNCTION create_institution(
  p_name text,
  p_admin_id uuid,
  p_commission_rate numeric DEFAULT 0.20,
  p_contact_info jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_institution_id uuid;
BEGIN
  -- Only platform admins can create institutions
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  -- Create the institution
  INSERT INTO institutions (name, admin_id, commission_rate, contact_info)
    VALUES (p_name, p_admin_id, p_commission_rate, p_contact_info)
    RETURNING id INTO v_institution_id;

  -- Promote the designated user to institution_admin
  UPDATE profiles SET role = 'institution_admin' WHERE id = p_admin_id;

  -- Ensure the admin has a wallet for commission payouts
  INSERT INTO agent_wallets (user_id)
    VALUES (p_admin_id)
    ON CONFLICT (user_id) DO NOTHING;

  RETURN v_institution_id;
END;
$$;

-- F2: accept_institution_invite -- any authenticated user joins via invite code
CREATE OR REPLACE FUNCTION accept_institution_invite(p_invite_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_user_id uuid;
  v_member_id uuid;
  v_code_base text;
  v_referral_code text;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Lock the invite row to prevent race conditions on used_count
  SELECT * INTO v_invite
    FROM institution_invites
    WHERE invite_code = p_invite_code
    FOR UPDATE;

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF NOT v_invite.is_active THEN
    RAISE EXCEPTION 'Invite is no longer active';
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'Invite has expired';
  END IF;

  IF v_invite.max_uses IS NOT NULL AND v_invite.used_count >= v_invite.max_uses THEN
    RAISE EXCEPTION 'Invite has reached maximum uses';
  END IF;

  -- Check not already an active member
  IF EXISTS (
    SELECT 1 FROM institution_members
    WHERE institution_id = v_invite.institution_id
      AND user_id = v_user_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Already a member of this institution';
  END IF;

  -- Prevent institution admin from joining their own institution as ambassador
  IF EXISTS (
    SELECT 1 FROM institutions
    WHERE id = v_invite.institution_id AND admin_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Institution admin cannot join as ambassador';
  END IF;

  -- Insert or reactivate membership (handles previously removed members)
  INSERT INTO institution_members (institution_id, user_id, status, joined_at)
    VALUES (v_invite.institution_id, v_user_id, 'active', now())
    ON CONFLICT (institution_id, user_id)
    DO UPDATE SET status = 'active', joined_at = now()
    RETURNING id INTO v_member_id;

  -- Generate an agent-type referral code linked to this institution
  v_code_base := upper(substr(md5(random()::text), 1, 6));
  v_referral_code := 'UT-' || v_code_base;

  INSERT INTO referral_codes (user_id, code, type, institution_id, is_active)
    VALUES (v_user_id, v_referral_code, 'agent', v_invite.institution_id, true);

  -- Increment invite usage counter
  UPDATE institution_invites SET used_count = used_count + 1
    WHERE id = v_invite.id;

  RETURN v_member_id;
END;
$$;

-- F3: remove_institution_member -- institution admin removes a member
CREATE OR REPLACE FUNCTION remove_institution_member(
  p_institution_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is the institution admin
  IF NOT EXISTS (
    SELECT 1 FROM institutions
    WHERE id = p_institution_id AND admin_id = (SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'Permission denied: not institution admin';
  END IF;

  -- Mark member as removed
  UPDATE institution_members
    SET status = 'removed'
    WHERE institution_id = p_institution_id AND user_id = p_user_id;

  -- Deactivate their referral codes for this institution
  UPDATE referral_codes
    SET is_active = false
    WHERE user_id = p_user_id AND institution_id = p_institution_id;
END;
$$;
