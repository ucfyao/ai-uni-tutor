/**
 * Referral Repository Implementation
 *
 * Handles referral codes and referral relationship database operations.
 */

import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import type {
  ReferralCodeEntity,
  ReferralCodeType,
  ReferralEntity,
  ReferralStatus,
  ReferralWithReferee,
} from '@/types/referral';

type ReferralCodeRow = Database['public']['Tables']['referral_codes']['Row'];
type ReferralRow = Database['public']['Tables']['referrals']['Row'];

export class ReferralRepository {
  // ── Mappers ──────────────────────────────────────────────────────────

  private mapCodeToEntity(row: ReferralCodeRow): ReferralCodeEntity {
    return {
      id: row.id,
      userId: row.user_id,
      code: row.code,
      type: row.type as ReferralCodeType,
      stripePromotionCodeId: row.stripe_promotion_code_id,
      institutionId: row.institution_id ?? null,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapReferralToEntity(row: ReferralRow): ReferralEntity {
    return {
      id: row.id,
      referrerId: row.referrer_id,
      refereeId: row.referee_id,
      referralCodeId: row.referral_code_id,
      status: row.status as ReferralStatus,
      stripeSubscriptionId: row.stripe_subscription_id,
      createdAt: new Date(row.created_at),
    };
  }

  // ── Referral Codes ───────────────────────────────────────────────────

  async findCodeByCode(code: string): Promise<ReferralCodeEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('code', code)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch referral code: ${error.message}`, error);
    }
    if (!data) return null;
    return this.mapCodeToEntity(data);
  }

  async findCodeById(id: string): Promise<ReferralCodeEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.from('referral_codes').select('*').eq('id', id).single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch referral code by id: ${error.message}`, error);
    }
    if (!data) return null;
    return this.mapCodeToEntity(data);
  }

  async findCodesByUserId(userId: string): Promise<ReferralCodeEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new DatabaseError(`Failed to fetch referral codes: ${error.message}`, error);
    }
    return (data ?? []).map((row) => this.mapCodeToEntity(row));
  }

  async createCode(input: {
    userId: string;
    code: string;
    type: ReferralCodeType;
    stripePromotionCodeId?: string;
  }): Promise<ReferralCodeEntity> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('referral_codes')
      .insert({
        user_id: input.userId,
        code: input.code,
        type: input.type,
        stripe_promotion_code_id: input.stripePromotionCodeId ?? null,
      })
      .select()
      .single();

    if (error) {
      throw new DatabaseError(`Failed to create referral code: ${error.message}`, error);
    }
    return this.mapCodeToEntity(data);
  }

  async toggleCodeActive(id: string, isActive: boolean): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('referral_codes')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new DatabaseError(`Failed to toggle referral code: ${error.message}`, error);
    }
  }

  // ── Referrals ────────────────────────────────────────────────────────

  async findReferralByRefereeId(refereeId: string): Promise<ReferralEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referee_id', refereeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch referral: ${error.message}`, error);
    }
    if (!data) return null;
    return this.mapReferralToEntity(data);
  }

  async findReferralsByReferrerId(referrerId: string): Promise<ReferralWithReferee[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('referrals')
      .select(
        'id, referee_id, status, created_at, profiles!referrals_referee_id_fkey(full_name, email)',
      )
      .eq('referrer_id', referrerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new DatabaseError(`Failed to fetch referrals: ${error.message}`, error);
    }

    return (data ?? []).map((row) => {
      const profile = row.profiles as unknown as {
        full_name: string | null;
        email: string | null;
      } | null;
      return {
        id: row.id,
        refereeId: row.referee_id,
        refereeName: profile?.full_name ?? null,
        refereeEmail: profile?.email ?? null,
        status: row.status as ReferralStatus,
        createdAt: new Date(row.created_at),
      };
    });
  }

  async createReferral(input: {
    referrerId: string;
    refereeId: string;
    referralCodeId: string;
  }): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('referrals').insert({
      referrer_id: input.referrerId,
      referee_id: input.refereeId,
      referral_code_id: input.referralCodeId,
    });

    if (error) {
      throw new DatabaseError(`Failed to create referral: ${error.message}`, error);
    }
  }

  async updateReferralStatus(
    id: string,
    status: ReferralStatus,
    stripeSubscriptionId?: string,
  ): Promise<void> {
    const supabase = await createClient();
    const updates: Database['public']['Tables']['referrals']['Update'] = { status };
    if (stripeSubscriptionId !== undefined) {
      updates.stripe_subscription_id = stripeSubscriptionId;
    }

    const { error } = await supabase.from('referrals').update(updates).eq('id', id);

    if (error) {
      throw new DatabaseError(`Failed to update referral status: ${error.message}`, error);
    }
  }

  async countByReferrerId(referrerId: string): Promise<{ total: number; paid: number }> {
    const supabase = await createClient();

    const { count: total, error: totalErr } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', referrerId);

    if (totalErr) {
      throw new DatabaseError(`Failed to count referrals: ${totalErr.message}`, totalErr);
    }

    const { count: paid, error: paidErr } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', referrerId)
      .in('status', ['paid', 'rewarded']);

    if (paidErr) {
      throw new DatabaseError(`Failed to count paid referrals: ${paidErr.message}`, paidErr);
    }

    return { total: total ?? 0, paid: paid ?? 0 };
  }
}

let _referralRepository: ReferralRepository | null = null;

export function getReferralRepository(): ReferralRepository {
  if (!_referralRepository) {
    _referralRepository = new ReferralRepository();
  }
  return _referralRepository;
}
