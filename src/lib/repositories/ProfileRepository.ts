/**
 * Profile Repository Implementation
 *
 * Supabase-based implementation of IProfileRepository.
 * Handles all profile-related database operations.
 */

import type { IProfileRepository } from '@/lib/domain/interfaces/IProfileRepository';
import type {
  ProfileEntity,
  SubscriptionInfo,
  UpdateProfileDTO,
} from '@/lib/domain/models/Profile';
import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export class ProfileRepository implements IProfileRepository {
  private mapToEntity(row: ProfileRow): ProfileEntity {
    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      stripePriceId: row.stripe_price_id,
      subscriptionStatus: row.subscription_status,
      currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : null,
      role: row.role,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async findById(id: string): Promise<ProfileEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch profile: ${error.message}`, error);
    }
    if (!data) return null;
    return this.mapToEntity(data);
  }

  async update(id: string, dto: UpdateProfileDTO): Promise<void> {
    const supabase = await createClient();
    const updates: Database['public']['Tables']['profiles']['Update'] = {
      updated_at: new Date().toISOString(),
    };

    if (dto.fullName !== undefined) updates.full_name = dto.fullName;
    if (dto.stripeCustomerId !== undefined) updates.stripe_customer_id = dto.stripeCustomerId;
    if (dto.stripeSubscriptionId !== undefined)
      updates.stripe_subscription_id = dto.stripeSubscriptionId;
    if (dto.stripePriceId !== undefined) updates.stripe_price_id = dto.stripePriceId;
    if (dto.subscriptionStatus !== undefined) updates.subscription_status = dto.subscriptionStatus;
    if (dto.currentPeriodEnd !== undefined)
      updates.current_period_end = dto.currentPeriodEnd?.toISOString() ?? null;

    const { error } = await supabase.from('profiles').update(updates).eq('id', id);

    if (error) throw new DatabaseError(`Failed to update profile: ${error.message}`, error);
  }

  async getSubscriptionInfo(userId: string): Promise<SubscriptionInfo> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('subscription_status, current_period_end')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return { status: null, isPro: false, currentPeriodEnd: null };
      throw new DatabaseError(`Failed to fetch subscription info: ${error.message}`, error);
    }
    if (!data) {
      return { status: null, isPro: false, currentPeriodEnd: null };
    }

    const isPro = data.subscription_status === 'active' || data.subscription_status === 'trialing';

    return {
      status: data.subscription_status,
      isPro,
      currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end) : null,
    };
  }

  async getStripeCustomerId(userId: string): Promise<string | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch Stripe customer ID: ${error.message}`, error);
    }
    return data?.stripe_customer_id ?? null;
  }

  async updateStripeCustomerId(userId: string, customerId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) throw new DatabaseError(`Failed to update Stripe customer ID: ${error.message}`, error);
  }

  async updateSubscription(
    userId: string,
    data: {
      stripe_subscription_id?: string | null;
      stripe_customer_id?: string;
      subscription_status: string;
      current_period_end?: string | null;
      stripe_price_id?: string | null;
    },
  ): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) throw new DatabaseError(`Failed to update subscription: ${error.message}`, error);
  }

  async updateSubscriptionBySubscriptionId(
    subscriptionId: string,
    data: {
      subscription_status: string;
      current_period_end?: string | null;
      stripe_price_id?: string | null;
    },
  ): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscriptionId);

    if (error) throw new DatabaseError(`Failed to update subscription by ID: ${error.message}`, error);
  }
}

let _profileRepository: ProfileRepository | null = null;

export function getProfileRepository(): ProfileRepository {
  if (!_profileRepository) {
    _profileRepository = new ProfileRepository();
  }
  return _profileRepository;
}
