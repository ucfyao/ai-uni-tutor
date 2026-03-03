-- Migration: Referral System Hardening
-- Fixes: race conditions, non-atomic operations, currency mismatch, clawback

-- ============================================================================
-- A) Prevent double-crediting: unique constraint on commissions
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_commissions_referral_type_unique
  ON commissions(referral_id, type);

-- ============================================================================
-- B) Prevent negative wallet balance
-- ============================================================================
ALTER TABLE agent_wallets
  DROP CONSTRAINT IF EXISTS agent_wallets_balance_nonneg;
ALTER TABLE agent_wallets
  ADD CONSTRAINT agent_wallets_balance_nonneg CHECK (balance >= 0);

-- ============================================================================
-- C) Extend commission status for clawbacks
-- ============================================================================
ALTER TABLE commissions
  DROP CONSTRAINT IF EXISTS commissions_status_check;
ALTER TABLE commissions
  ADD CONSTRAINT commissions_status_check
  CHECK (status IN ('pending', 'credited', 'paid_out', 'clawed_back'));

-- ============================================================================
-- D) Fix process_referral_payment: add FOR UPDATE + fix currency
-- ============================================================================
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
  v_referral referrals%ROWTYPE;
  v_code referral_codes%ROWTYPE;
  v_reward_days numeric;
  v_commission_rate numeric;
  v_cash_amount numeric;
  v_base_amount numeric;
BEGIN
  -- Lock the referral row to prevent concurrent double-crediting
  SELECT * INTO v_referral
    FROM referrals
    WHERE referee_id = p_referee_id
    FOR UPDATE
    LIMIT 1;

  IF v_referral IS NULL THEN
    RETURN;
  END IF;

  IF v_referral.status = 'rewarded' THEN
    RETURN;
  END IF;

  UPDATE referrals
    SET status = 'paid',
        stripe_subscription_id = p_stripe_subscription_id
    WHERE id = v_referral.id;

  SELECT * INTO v_code
    FROM referral_codes
    WHERE id = v_referral.referral_code_id;

  IF v_code IS NULL THEN
    RETURN;
  END IF;

  IF v_code.type = 'user' THEN
    SELECT COALESCE((value)::numeric, 7) INTO v_reward_days
      FROM referral_config WHERE key = 'user_reward_days';

    INSERT INTO commissions (referral_id, beneficiary_id, type, amount, currency)
      VALUES (v_referral.id, v_referral.referrer_id, 'pro_days', v_reward_days, 'days')
      ON CONFLICT (referral_id, type) DO NOTHING;

    UPDATE profiles
      SET current_period_end = GREATEST(
            COALESCE(current_period_end::timestamptz, now()),
            now()
          ) + (v_reward_days || ' days')::interval,
          subscription_status = 'active'
      WHERE id = v_referral.referrer_id;

  ELSIF v_code.type = 'agent' THEN
    SELECT COALESCE((value)::numeric, 0.20) INTO v_commission_rate
      FROM referral_config WHERE key = 'agent_commission_rate';

    v_base_amount := COALESCE(p_payment_amount, 0);
    v_cash_amount := v_base_amount * v_commission_rate;

    IF v_cash_amount > 0 THEN
      INSERT INTO commissions (referral_id, beneficiary_id, type, amount, currency)
        VALUES (v_referral.id, v_referral.referrer_id, 'cash', v_cash_amount, 'cny')
        ON CONFLICT (referral_id, type) DO NOTHING;

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

-- ============================================================================
-- E) Atomic withdrawal request (check + deduct + create in one tx)
-- ============================================================================
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
  v_wallet agent_wallets%ROWTYPE;
  v_min_withdrawal numeric;
  v_withdrawal_id uuid;
BEGIN
  SELECT * INTO v_wallet
    FROM agent_wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

  IF v_wallet IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  SELECT COALESCE((value)::numeric, 50) INTO v_min_withdrawal
    FROM referral_config WHERE key = 'min_withdrawal_amount';

  IF p_amount < v_min_withdrawal THEN
    RAISE EXCEPTION 'Minimum withdrawal amount is %', v_min_withdrawal;
  END IF;

  IF v_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Deduct balance
  UPDATE agent_wallets
    SET balance = balance - p_amount,
        total_withdrawn = total_withdrawn + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;

  -- Create withdrawal record
  INSERT INTO withdrawal_requests (wallet_id, user_id, amount, payment_method)
    VALUES (v_wallet.id, p_user_id, p_amount, p_payment_method)
    RETURNING id INTO v_withdrawal_id;

  RETURN v_withdrawal_id;
END;
$$;

-- ============================================================================
-- F) Atomic application approval (status + role + wallet + code stub)
-- ============================================================================
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
  v_app agent_applications%ROWTYPE;
  v_wallet_id uuid;
BEGIN
  SELECT * INTO v_app
    FROM agent_applications
    WHERE id = p_application_id
    FOR UPDATE;

  IF v_app IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF v_app.status != 'pending' THEN
    RAISE EXCEPTION 'Application is not pending: %', v_app.status;
  END IF;

  -- Mark approved
  UPDATE agent_applications
    SET status = 'approved',
        reviewed_by = p_admin_id,
        reviewed_at = now()
    WHERE id = p_application_id;

  -- Promote to agent role
  UPDATE profiles
    SET role = 'agent'
    WHERE id = v_app.user_id;

  -- Create wallet (ignore if already exists)
  INSERT INTO agent_wallets (user_id)
    VALUES (v_app.user_id)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING id INTO v_wallet_id;

  RETURN v_app.user_id;
END;
$$;

-- ============================================================================
-- G) Clawback commission on refund
-- ============================================================================
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
  v_referral referrals%ROWTYPE;
  v_commission commissions%ROWTYPE;
BEGIN
  SELECT * INTO v_referral
    FROM referrals
    WHERE referee_id = p_referee_id
      AND stripe_subscription_id = p_stripe_subscription_id
    FOR UPDATE
    LIMIT 1;

  IF v_referral IS NULL THEN
    RETURN;
  END IF;

  -- Find cash commission for this referral
  SELECT * INTO v_commission
    FROM commissions
    WHERE referral_id = v_referral.id
      AND type = 'cash'
      AND status != 'clawed_back'
    FOR UPDATE
    LIMIT 1;

  IF v_commission IS NOT NULL THEN
    -- Reverse wallet credit
    UPDATE agent_wallets
      SET balance = GREATEST(balance - v_commission.amount, 0),
          total_earned = total_earned - v_commission.amount,
          updated_at = now()
      WHERE user_id = v_referral.referrer_id;

    -- Mark commission as clawed back
    UPDATE commissions
      SET status = 'clawed_back'
      WHERE id = v_commission.id;
  END IF;
END;
$$;

-- ============================================================================
-- H) Fix increment_wallet_balance to not touch total_withdrawn
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_wallet_balance(
  p_user_id uuid,
  p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE agent_wallets
    SET balance = balance + p_amount,
        total_earned = CASE WHEN p_amount > 0 THEN total_earned + p_amount ELSE total_earned END,
        updated_at = now()
    WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;
END;
$$;
