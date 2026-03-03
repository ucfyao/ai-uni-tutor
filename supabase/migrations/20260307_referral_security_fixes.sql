-- =====================================================================
-- Migration: 20260307_referral_security_fixes.sql
-- Fixes P0/P1 security issues from post-hardening review:
--   - RPC auth checks (privilege escalation)
--   - Dangerous RLS policies
--   - Missing stripe_events table
--   - Self-referral prevention
--   - Clawback & payment edge cases
-- =====================================================================

-- ===== A) Create stripe_events table for webhook idempotency =====

CREATE TABLE IF NOT EXISTS stripe_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

-- Webhook runs server-side with anon key (no auth.uid()).
-- Table holds non-sensitive event IDs only — permissive policy is acceptable.
CREATE POLICY "Allow all access to stripe_events" ON stripe_events
  FOR ALL USING (true) WITH CHECK (true);

-- ===== B) Self-referral CHECK constraint =====

ALTER TABLE referrals ADD CONSTRAINT no_self_referral
  CHECK (referrer_id != referee_id);

-- ===== C) Drop dangerous commissions INSERT policy =====
-- Commission rows must only be created by SECURITY DEFINER RPCs.

DROP POLICY IF EXISTS "Beneficiaries can insert own commission" ON commissions;

-- ===== D) Fix referrals INSERT policy — prevent self-referral via RLS =====

DROP POLICY IF EXISTS "Referees can insert own referral" ON referrals;
CREATE POLICY "Referees can insert own referral" ON referrals
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) = referee_id
    AND referee_id != referrer_id
  );

-- ===== E) Fix referral_codes UPDATE — add WITH CHECK =====

DROP POLICY IF EXISTS "Users can update own referral codes" ON referral_codes;
CREATE POLICY "Users can update own referral codes" ON referral_codes
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ===== F) Perf: optimize hot RLS policies with (SELECT auth.uid()) =====

DROP POLICY IF EXISTS "Users can view referrals they are part of" ON referrals;
CREATE POLICY "Users can view referrals they are part of" ON referrals
  FOR SELECT USING (
    (SELECT auth.uid()) = referrer_id OR (SELECT auth.uid()) = referee_id
  );

DROP POLICY IF EXISTS "Users can view own commissions" ON commissions;
CREATE POLICY "Users can view own commissions" ON commissions
  FOR SELECT USING ((SELECT auth.uid()) = beneficiary_id);

DROP POLICY IF EXISTS "Users can view own wallet" ON agent_wallets;
CREATE POLICY "Users can view own wallet" ON agent_wallets
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own withdrawals" ON withdrawal_requests;
CREATE POLICY "Users can view own withdrawals" ON withdrawal_requests
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own withdrawals" ON withdrawal_requests;
CREATE POLICY "Users can insert own withdrawals" ON withdrawal_requests
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- ===== G) Fix approve_agent_application — add admin auth check =====

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

  UPDATE agent_applications
    SET status = 'approved', reviewed_by = p_admin_id, reviewed_at = now()
    WHERE id = p_application_id;

  UPDATE profiles SET role = 'agent' WHERE id = v_app.user_id;

  INSERT INTO agent_wallets (user_id)
    VALUES (v_app.user_id)
    ON CONFLICT (user_id) DO NOTHING;

  RETURN v_app.user_id;
END;
$$;

-- ===== H) Fix reject_withdrawal_with_refund — add admin auth check =====

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

  UPDATE withdrawal_requests
    SET status = 'rejected', reviewed_by = p_admin_id, reviewed_at = now()
    WHERE id = p_withdrawal_id;

  UPDATE agent_wallets
    SET balance = balance + v_wd.amount, updated_at = now()
    WHERE id = v_wd.wallet_id;
END;
$$;

-- ===== I) Fix request_withdrawal_atomic — verify caller identity =====

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
  v_min_amount := COALESCE(v_min_amount, 5000);

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

-- ===== J) Fix get_referral_daily_trend — auth check + bound p_days =====

CREATE OR REPLACE FUNCTION get_referral_daily_trend(
  p_user_id uuid,
  p_days integer DEFAULT 30
)
RETURNS TABLE(date date, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT auth.uid()) != p_user_id AND NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF p_days < 1 OR p_days > 365 THEN
    RAISE EXCEPTION 'p_days must be between 1 and 365';
  END IF;

  RETURN QUERY
    SELECT d::date AS date, COALESCE(COUNT(r.id), 0) AS count
    FROM generate_series(
      (CURRENT_DATE - (p_days || ' days')::interval)::date,
      CURRENT_DATE,
      '1 day'::interval
    ) AS d
    LEFT JOIN referrals r
      ON r.referrer_id = p_user_id
      AND r.created_at::date = d::date
    GROUP BY d::date
    ORDER BY d::date;
END;
$$;

-- ===== K) Fix process_referral_payment — RAISE on missing code, guard 'paid' =====

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

  IF v_code.type = 'user' THEN
    SELECT COALESCE((value::integer), 7) INTO v_reward_days
      FROM referral_config WHERE key = 'user_reward_days';
    INSERT INTO commissions (referral_id, beneficiary_id, type, amount, currency)
      VALUES (v_referral.id, v_referral.referrer_id, 'pro_days', v_reward_days, 'days')
      ON CONFLICT DO NOTHING;
  ELSIF v_code.type = 'agent' THEN
    SELECT COALESCE((value::numeric), 0.2) INTO v_commission_rate
      FROM referral_config WHERE key = 'agent_commission_rate';
    v_cash_amount := COALESCE(p_payment_amount, 0) * v_commission_rate;
    IF v_cash_amount > 0 THEN
      INSERT INTO commissions (referral_id, beneficiary_id, type, amount, currency)
        VALUES (v_referral.id, v_referral.referrer_id, 'cash', v_cash_amount, 'cny')
        ON CONFLICT DO NOTHING;
      UPDATE agent_wallets
        SET balance = balance + v_cash_amount,
            total_earned = total_earned + v_cash_amount,
            updated_at = now()
        WHERE user_id = v_referral.referrer_id;
    END IF;
  END IF;

  UPDATE referrals SET status = 'rewarded' WHERE id = v_referral.id;
END;
$$;

-- ===== L) Fix clawback_referral_commission — cap deductions to balance =====

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

  -- Clamp clawback to available balance
  v_actual_clawback := LEAST(
    v_commission.amount,
    (SELECT balance FROM agent_wallets WHERE user_id = v_referral.referrer_id)
  );

  IF v_actual_clawback > 0 THEN
    UPDATE agent_wallets
      SET balance = balance - v_actual_clawback,
          total_earned = total_earned - v_actual_clawback,
          updated_at = now()
      WHERE user_id = v_referral.referrer_id;
  END IF;
END;
$$;
