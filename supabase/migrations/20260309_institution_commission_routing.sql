-- Migration: Institution Commission Routing
-- Modifies process_referral_payment to route commissions to the institution
-- admin's wallet when the referral code belongs to an institution ambassador.
--
-- The institution check must come BEFORE the existing agent/user type checks,
-- because an ambassador's code has type = 'agent' AND institution_id IS NOT NULL.
-- When institution_id IS NOT NULL:
--   1. Look up the institution's commission_rate and admin_id
--   2. Calculate cash commission = payment_amount * institution commission_rate
--   3. Insert commission record with beneficiary = institution admin
--   4. Credit the admin's wallet
-- The ambassador's own agent-type commission is intentionally skipped —
-- institution codes route to the institution admin, not the ambassador.

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

    IF v_beneficiary IS NOT NULL THEN
      v_cash_amount := COALESCE(p_payment_amount, 0) * v_commission_rate;
      IF v_cash_amount > 0 THEN
        INSERT INTO commissions (referral_id, beneficiary_id, type, amount, currency)
          VALUES (v_referral.id, v_beneficiary, 'cash', v_cash_amount, 'cny')
          ON CONFLICT DO NOTHING;
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
