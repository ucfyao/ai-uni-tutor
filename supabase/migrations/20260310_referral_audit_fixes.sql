-- =====================================================================
-- Migration: 20260310_referral_audit_fixes.sql
-- Post-audit fixes for referral system:
--   1A) process_referral_payment — fix double-credit on retry
--   1B) clawback_referral_commission — FOR UPDATE on wallet read
--   (1C removed: total_withdrawn not touched since request doesn't increment it)
--   1E) approve/reject/complete — use auth.uid() for audit stamp
--   1F) stripe_events — lock down RLS
--   1G) accept_institution_invite — code collision retry
--   1H) process_referral_payment — raise on inactive institution
--   1I) Tighten RLS policies
--   1D) request_withdrawal_atomic — fix min amount fallback (20260307 regressed to 5000)
-- =====================================================================

-- ===== 1A + 1H) process_referral_payment — RETURNING guard + inactive institution raise =====
-- Latest base: 20260309_institution_commission_routing.sql
-- Fixes:
--   - Uses RETURNING id INTO v_commission_id to detect actual insert
--   - Only credits wallet when the INSERT actually happened (prevents double-credit on retry)
--   - RAISEs when institution is inactive instead of silently skipping

CREATE OR REPLACE FUNCTION process_referral_payment(
  p_referee_id uuid,
  p_stripe_subscription_id text,
  p_payment_amount numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral RECORD;
  v_code RECORD;
  v_reward_days integer;
  v_commission_rate numeric;
  v_cash_amount numeric;
  v_beneficiary uuid;
  v_commission_id uuid;
BEGIN
  SELECT * INTO v_referral
    FROM referrals
    WHERE referee_id = p_referee_id
    FOR UPDATE;

  IF v_referral IS NULL THEN
    RETURN;
  END IF;

  -- Idempotency: skip if already paid or rewarded
  IF v_referral.status IN ('paid', 'rewarded') THEN
    RETURN;
  END IF;

  UPDATE referrals
    SET status = 'paid', stripe_subscription_id = p_stripe_subscription_id
    WHERE id = v_referral.id;

  SELECT * INTO v_code
    FROM referral_codes WHERE id = v_referral.referral_code_id;

  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Referral code % not found for referral %',
      v_referral.referral_code_id, v_referral.id;
  END IF;

  -- Institution commission routing (must check BEFORE agent/user types)
  IF v_code.institution_id IS NOT NULL THEN
    SELECT commission_rate, admin_id
      INTO v_commission_rate, v_beneficiary
      FROM institutions
      WHERE id = v_code.institution_id AND is_active = true;

    -- 1H: Raise on inactive institution instead of silently skipping
    IF v_beneficiary IS NULL THEN
      RAISE EXCEPTION 'Institution is inactive - referral cannot be processed';
    END IF;

    v_cash_amount := COALESCE(p_payment_amount, 0) * v_commission_rate;
    IF v_cash_amount > 0 THEN
      -- 1A: Use RETURNING to detect actual insert; only credit wallet if row was inserted
      INSERT INTO commissions (referral_id, beneficiary_id, type, amount, currency)
        VALUES (v_referral.id, v_beneficiary, 'cash', v_cash_amount, 'cny')
        ON CONFLICT (referral_id, type) DO NOTHING
        RETURNING id INTO v_commission_id;

      IF v_commission_id IS NOT NULL THEN
        UPDATE agent_wallets
          SET balance = balance + v_cash_amount,
              total_earned = total_earned + v_cash_amount,
              updated_at = now()
          WHERE user_id = v_beneficiary;
      END IF;
    END IF;

  ELSIF v_code.type = 'user' THEN
    SELECT COALESCE((value::integer), 7) INTO v_reward_days
      FROM referral_config WHERE key = 'user_reward_days';
    -- User branch: pro_days commission, no wallet update needed
    INSERT INTO commissions (referral_id, beneficiary_id, type, amount, currency)
      VALUES (v_referral.id, v_referral.referrer_id, 'pro_days', v_reward_days, 'days')
      ON CONFLICT (referral_id, type) DO NOTHING;

  ELSIF v_code.type = 'agent' THEN
    SELECT COALESCE((value::numeric), 0.2) INTO v_commission_rate
      FROM referral_config WHERE key = 'agent_commission_rate';
    v_cash_amount := COALESCE(p_payment_amount, 0) * v_commission_rate;
    IF v_cash_amount > 0 THEN
      -- 1A: Use RETURNING to detect actual insert; only credit wallet if row was inserted
      INSERT INTO commissions (referral_id, beneficiary_id, type, amount, currency)
        VALUES (v_referral.id, v_referral.referrer_id, 'cash', v_cash_amount, 'cny')
        ON CONFLICT (referral_id, type) DO NOTHING
        RETURNING id INTO v_commission_id;

      IF v_commission_id IS NOT NULL THEN
        UPDATE agent_wallets
          SET balance = balance + v_cash_amount,
              total_earned = total_earned + v_cash_amount,
              updated_at = now()
          WHERE user_id = v_referral.referrer_id;
      END IF;
    END IF;
  END IF;

  UPDATE referrals SET status = 'rewarded' WHERE id = v_referral.id;
END;
$$;

-- ===== 1B) clawback_referral_commission — FOR UPDATE on wallet read =====
-- Latest base: 20260307_referral_security_fixes.sql (section M)
-- Fix: Lock wallet row with FOR UPDATE before reading balance for LEAST() calc

CREATE OR REPLACE FUNCTION clawback_referral_commission(
  p_referee_id uuid,
  p_stripe_subscription_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral RECORD;
  v_commission RECORD;
  v_actual_clawback numeric;
  v_wallet_balance numeric;
BEGIN
  SELECT * INTO v_referral
    FROM referrals
    WHERE referee_id = p_referee_id
      AND stripe_subscription_id = p_stripe_subscription_id;

  IF v_referral IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_commission
    FROM commissions
    WHERE referral_id = v_referral.id
      AND type = 'cash'
      AND status != 'clawed_back'
    LIMIT 1;

  IF v_commission IS NULL THEN
    RETURN;
  END IF;

  UPDATE commissions SET status = 'clawed_back' WHERE id = v_commission.id;

  -- Lock the wallet row BEFORE reading balance to prevent TOCTOU race
  -- Use v_commission.beneficiary_id (not v_referral.referrer_id) because
  -- institution commissions route to the admin, not the ambassador
  SELECT balance INTO v_wallet_balance
    FROM agent_wallets
    WHERE user_id = v_commission.beneficiary_id
    FOR UPDATE;

  -- Clamp clawback to available balance
  v_actual_clawback := LEAST(v_commission.amount, COALESCE(v_wallet_balance, 0));

  IF v_actual_clawback > 0 THEN
    UPDATE agent_wallets
      SET balance = balance - v_actual_clawback,
          total_earned = total_earned - v_actual_clawback,
          updated_at = now()
      WHERE user_id = v_commission.beneficiary_id;
  END IF;
END;
$$;

-- ===== 1E) reject_withdrawal_with_refund — auth.uid() for audit stamp =====
-- Latest base: 20260307_referral_security_fixes.sql (section H)
-- Fix: Uses (SELECT auth.uid()) for audit stamp instead of p_admin_id
-- Note: total_withdrawn is NOT decremented on rejection because the latest
-- request_withdrawal_atomic (20260307) does NOT increment it at request time.
-- total_withdrawn is only incremented in complete_withdrawal_atomic.

CREATE OR REPLACE FUNCTION reject_withdrawal_with_refund(
  p_withdrawal_id uuid,
  p_admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wd RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  SELECT * INTO v_wd
    FROM withdrawal_requests
    WHERE id = p_withdrawal_id
    FOR UPDATE;

  IF v_wd IS NULL THEN
    RAISE EXCEPTION 'Withdrawal not found';
  END IF;

  IF v_wd.status != 'pending' THEN
    RAISE EXCEPTION 'Withdrawal is not pending, current status: %', v_wd.status;
  END IF;

  -- 1E: Use auth.uid() instead of caller-supplied p_admin_id
  UPDATE withdrawal_requests
    SET status = 'rejected', reviewed_by = (SELECT auth.uid()), reviewed_at = now()
    WHERE id = p_withdrawal_id;

  -- Refund balance only (total_withdrawn not touched — see header comment)
  UPDATE agent_wallets
    SET balance = balance + v_wd.amount,
        updated_at = now()
    WHERE id = v_wd.wallet_id;
END;
$$;

-- ===== 1E) approve_agent_application — use auth.uid() for audit stamp =====
-- Latest base: 20260307_referral_security_fixes.sql (section G)

CREATE OR REPLACE FUNCTION approve_agent_application(
  p_application_id uuid,
  p_admin_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app RECORD;
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  SELECT * INTO v_app
    FROM agent_applications
    WHERE id = p_application_id
    FOR UPDATE;

  IF v_app IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF v_app.status != 'pending' THEN
    RAISE EXCEPTION 'Application is not pending';
  END IF;

  -- 1E: Use auth.uid() instead of caller-supplied p_admin_id
  UPDATE agent_applications
    SET status = 'approved', reviewed_by = (SELECT auth.uid()), reviewed_at = now()
    WHERE id = p_application_id;

  UPDATE profiles SET role = 'agent' WHERE id = v_app.user_id;

  INSERT INTO agent_wallets (user_id)
    VALUES (v_app.user_id)
    ON CONFLICT (user_id) DO NOTHING;

  RETURN v_app.user_id;
END;
$$;

-- ===== 1E) complete_withdrawal_atomic — use auth.uid() for audit stamp =====
-- Latest base: 20260307_referral_security_fixes.sql (section L)

CREATE OR REPLACE FUNCTION complete_withdrawal_atomic(
  p_withdrawal_id uuid,
  p_admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wd RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  SELECT * INTO v_wd
    FROM withdrawal_requests
    WHERE id = p_withdrawal_id
    FOR UPDATE;

  IF v_wd IS NULL THEN
    RAISE EXCEPTION 'Withdrawal not found';
  END IF;

  IF v_wd.status != 'approved' THEN
    RAISE EXCEPTION 'Only approved withdrawals can be completed';
  END IF;

  -- 1E: Use auth.uid() instead of caller-supplied p_admin_id
  UPDATE withdrawal_requests
    SET status = 'completed', reviewed_by = (SELECT auth.uid()), reviewed_at = now()
    WHERE id = p_withdrawal_id;

  UPDATE agent_wallets
    SET total_withdrawn = total_withdrawn + v_wd.amount, updated_at = now()
    WHERE id = v_wd.wallet_id;
END;
$$;

-- ===== 1D) request_withdrawal_atomic — fix min amount fallback =====
-- 20260307 regressed the COALESCE fallback from 50 back to 5000.
-- Re-apply the correct fallback of 50.

CREATE OR REPLACE FUNCTION request_withdrawal_atomic(
  p_user_id uuid,
  p_amount numeric,
  p_payment_method jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet RECORD;
  v_min_amount numeric;
  v_withdrawal_id uuid;
BEGIN
  IF (SELECT auth.uid()) != p_user_id THEN
    RAISE EXCEPTION 'Permission denied: cannot withdraw on behalf of another user';
  END IF;

  SELECT (value::numeric) INTO v_min_amount
    FROM referral_config WHERE key = 'min_withdrawal_amount';
  v_min_amount := COALESCE(v_min_amount, 50);

  IF p_amount < v_min_amount THEN
    RAISE EXCEPTION 'Minimum withdrawal amount is %', v_min_amount;
  END IF;

  SELECT * INTO v_wallet
    FROM agent_wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

  IF v_wallet IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  IF v_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE agent_wallets
    SET balance = balance - p_amount, updated_at = now()
    WHERE id = v_wallet.id;

  INSERT INTO withdrawal_requests (wallet_id, user_id, amount, payment_method)
    VALUES (v_wallet.id, p_user_id, p_amount, p_payment_method)
    RETURNING id INTO v_withdrawal_id;

  RETURN v_withdrawal_id;
END;
$$;

-- ===== 1F) stripe_events — lock down RLS =====
-- Webhook uses service role key, so no client should ever access this table directly.

DROP POLICY IF EXISTS "Allow all access to stripe_events" ON stripe_events;
CREATE POLICY "Deny all client access to stripe_events" ON stripe_events
  FOR ALL USING (false) WITH CHECK (false);

-- ===== 1G) accept_institution_invite — code collision retry =====
-- Latest base: 20260308_institution_system.sql (section F2)
-- Fix: Retry up to 5 times on unique_violation for referral code generation

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
  i integer;
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

  -- 1G: Generate an agent-type referral code with collision retry (up to 5 attempts)
  FOR i IN 1..5 LOOP
    v_code_base := upper(substr(md5(random()::text || i::text), 1, 8));
    v_referral_code := 'UT-' || v_code_base;
    BEGIN
      INSERT INTO referral_codes (user_id, code, type, institution_id, is_active)
        VALUES (v_user_id, v_referral_code, 'agent', v_invite.institution_id, true);
      EXIT;  -- success, break out of loop
    EXCEPTION WHEN unique_violation THEN
      IF i = 5 THEN
        RAISE EXCEPTION 'Failed to generate unique referral code after 5 attempts';
      END IF;
    END;
  END LOOP;

  -- Increment invite usage counter
  UPDATE institution_invites SET used_count = used_count + 1
    WHERE id = v_invite.id;

  RETURN v_member_id;
END;
$$;

-- ===== 1I) Tighten RLS policies =====

-- referral_codes: users can only insert type='user' codes (agent codes created by RPC)
DROP POLICY IF EXISTS "Users can insert own referral codes" ON referral_codes;
CREATE POLICY "Users can insert own user referral codes" ON referral_codes
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND type = 'user'
    AND institution_id IS NULL
  );

-- withdrawal_requests: drop user INSERT (must go through request_withdrawal_atomic RPC)
DROP POLICY IF EXISTS "Users can insert own withdrawals" ON withdrawal_requests;
