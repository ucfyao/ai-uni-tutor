-- Migration: Referral & Campus Agent System

-- Extend profiles role to include 'agent'
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'admin', 'super_admin', 'agent'));

-- 1. referral_codes
CREATE TABLE referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code varchar(50) NOT NULL UNIQUE,
  type varchar(10) NOT NULL CHECK (type IN ('user', 'agent')),
  stripe_promotion_code_id varchar(255),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_referral_codes_user_id ON referral_codes(user_id);
CREATE INDEX idx_referral_codes_code ON referral_codes(code);
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own referral codes" ON referral_codes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own referral codes" ON referral_codes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own referral codes" ON referral_codes FOR UPDATE USING (auth.uid() = user_id);

-- 2. referrals
CREATE TABLE referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code_id uuid NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'paid', 'rewarded')),
  stripe_subscription_id varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referee_id)
);
CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX idx_referrals_referee_id ON referrals(referee_id);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view referrals they are part of" ON referrals FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

-- 3. commissions
CREATE TABLE commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type varchar(20) NOT NULL CHECK (type IN ('pro_days', 'cash')),
  amount numeric NOT NULL,
  currency varchar(10) NOT NULL DEFAULT 'cny',
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'credited', 'paid_out')),
  stripe_invoice_id varchar(255),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_commissions_beneficiary ON commissions(beneficiary_id);
CREATE INDEX idx_commissions_referral ON commissions(referral_id);
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own commissions" ON commissions FOR SELECT USING (auth.uid() = beneficiary_id);

-- 4. agent_applications
CREATE TABLE agent_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name varchar(255) NOT NULL,
  university varchar(255) NOT NULL,
  contact_info jsonb NOT NULL DEFAULT '{}',
  motivation text NOT NULL DEFAULT '',
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_applications_user ON agent_applications(user_id);
CREATE INDEX idx_agent_applications_status ON agent_applications(status);
ALTER TABLE agent_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own applications" ON agent_applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own applications" ON agent_applications FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. agent_wallets
CREATE TABLE agent_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  total_earned numeric NOT NULL DEFAULT 0,
  total_withdrawn numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE agent_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own wallet" ON agent_wallets FOR SELECT USING (auth.uid() = user_id);

-- 6. withdrawal_requests
CREATE TABLE withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES agent_wallets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method jsonb NOT NULL DEFAULT '{}',
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_withdrawal_requests_user ON withdrawal_requests(user_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own withdrawals" ON withdrawal_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own withdrawals" ON withdrawal_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. referral_config (key-value settings)
CREATE TABLE referral_config (
  key varchar(100) PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE referral_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read config" ON referral_config FOR SELECT USING (true);

INSERT INTO referral_config (key, value) VALUES
  ('user_reward_days', '7'),
  ('agent_commission_rate', '0.20'),
  ('min_withdrawal_amount', '5000'),
  ('referee_discount_percent', '10');

-- Admin policies for management
CREATE POLICY "Admins can view all referral codes" ON referral_codes FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins can view all referrals" ON referrals FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins can view all commissions" ON commissions FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins can view all applications" ON agent_applications FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins can update applications" ON agent_applications FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins can view all wallets" ON agent_wallets FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins can view all withdrawals" ON withdrawal_requests FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins can update withdrawals" ON withdrawal_requests FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins can update config" ON referral_config FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
