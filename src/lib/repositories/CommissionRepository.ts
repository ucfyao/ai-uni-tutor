/**
 * Commission Repository Implementation
 *
 * Handles commission records for the referral reward system.
 */

import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import type { CommissionEntity, CommissionStatus, CommissionType } from '@/types/referral';

type CommissionRow = Database['public']['Tables']['commissions']['Row'];

export class CommissionRepository {
  private mapToEntity(row: CommissionRow): CommissionEntity {
    return {
      id: row.id,
      referralId: row.referral_id,
      beneficiaryId: row.beneficiary_id,
      type: row.type as CommissionType,
      amount: row.amount,
      currency: row.currency,
      status: row.status as CommissionStatus,
      stripeInvoiceId: row.stripe_invoice_id,
      createdAt: new Date(row.created_at),
    };
  }

  async create(input: {
    referralId: string;
    beneficiaryId: string;
    type: CommissionType;
    amount: number;
    currency?: string;
    stripeInvoiceId?: string;
  }): Promise<CommissionEntity> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('commissions')
      .insert({
        referral_id: input.referralId,
        beneficiary_id: input.beneficiaryId,
        type: input.type,
        amount: input.amount,
        currency: input.currency ?? 'usd',
        stripe_invoice_id: input.stripeInvoiceId ?? null,
      })
      .select()
      .single();

    if (error) {
      throw new DatabaseError(`Failed to create commission: ${error.message}`, error);
    }
    return this.mapToEntity(data);
  }

  async findByBeneficiaryId(userId: string): Promise<CommissionEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('commissions')
      .select('*')
      .eq('beneficiary_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new DatabaseError(`Failed to fetch commissions: ${error.message}`, error);
    }
    return (data ?? []).map((row) => this.mapToEntity(row));
  }

  async updateStatus(id: string, status: CommissionStatus): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('commissions').update({ status }).eq('id', id);

    if (error) {
      throw new DatabaseError(`Failed to update commission status: ${error.message}`, error);
    }
  }

  async sumByBeneficiary(userId: string, type?: CommissionType): Promise<number> {
    const supabase = await createClient();
    let query = supabase
      .from('commissions')
      .select('amount')
      .eq('beneficiary_id', userId);

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(`Failed to sum commissions: ${error.message}`, error);
    }

    return (data ?? []).reduce((sum, row) => sum + row.amount, 0);
  }

  async sumByBeneficiarySince(userId: string, since: Date): Promise<number> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('commissions')
      .select('amount')
      .eq('beneficiary_id', userId)
      .gte('created_at', since.toISOString());

    if (error) {
      throw new DatabaseError(`Failed to sum commissions since date: ${error.message}`, error);
    }

    return (data ?? []).reduce((sum, row) => sum + row.amount, 0);
  }
}

let _commissionRepository: CommissionRepository | null = null;

export function getCommissionRepository(): CommissionRepository {
  if (!_commissionRepository) {
    _commissionRepository = new CommissionRepository();
  }
  return _commissionRepository;
}
