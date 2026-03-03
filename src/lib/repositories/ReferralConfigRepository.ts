/**
 * Referral Config Repository Implementation
 *
 * Manages system-wide configuration values for the referral program.
 */

import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { ReferralConfigMap } from '@/types/referral';

const DEFAULT_CONFIG: ReferralConfigMap = {
  user_reward_days: 7,
  agent_commission_rate: 0.2,
  min_withdrawal_amount: 50,
  referee_discount_percent: 10,
};

export class ReferralConfigRepository {
  async getConfig(key: keyof ReferralConfigMap): Promise<number> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('referral_config')
      .select('value')
      .eq('key', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return DEFAULT_CONFIG[key];
      throw new DatabaseError(`Failed to fetch referral config: ${error.message}`, error);
    }
    if (!data) return DEFAULT_CONFIG[key];

    return typeof data.value === 'number' ? data.value : Number(data.value);
  }

  async getAllConfig(): Promise<ReferralConfigMap> {
    const supabase = await createClient();
    const { data, error } = await supabase.from('referral_config').select('key, value');

    if (error) {
      throw new DatabaseError(`Failed to fetch referral config: ${error.message}`, error);
    }

    const config = { ...DEFAULT_CONFIG };
    for (const row of data ?? []) {
      const key = row.key as keyof ReferralConfigMap;
      if (key in config) {
        config[key] = typeof row.value === 'number' ? row.value : Number(row.value);
      }
    }
    return config;
  }

  async updateConfig(key: keyof ReferralConfigMap, value: number): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('referral_config')
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );

    if (error) {
      throw new DatabaseError(`Failed to update referral config: ${error.message}`, error);
    }
  }
}

let _referralConfigRepository: ReferralConfigRepository | null = null;

export function getReferralConfigRepository(): ReferralConfigRepository {
  if (!_referralConfigRepository) {
    _referralConfigRepository = new ReferralConfigRepository();
  }
  return _referralConfigRepository;
}
