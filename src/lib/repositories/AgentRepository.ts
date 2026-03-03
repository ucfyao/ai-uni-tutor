/**
 * Agent Repository Implementation
 *
 * Handles campus agent applications, wallets, and withdrawal requests.
 */

import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/database';
import type {
  AgentApplicationEntity,
  AgentWalletEntity,
  ApplicationStatus,
  WithdrawalRequestEntity,
  WithdrawalStatus,
} from '@/types/referral';

type AgentApplicationRow = Database['public']['Tables']['agent_applications']['Row'];
type AgentWalletRow = Database['public']['Tables']['agent_wallets']['Row'];
type WithdrawalRequestRow = Database['public']['Tables']['withdrawal_requests']['Row'];

export class AgentRepository {
  // ── Mappers ──────────────────────────────────────────────────────────

  private mapApplicationToEntity(row: AgentApplicationRow): AgentApplicationEntity {
    return {
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      university: row.university,
      contactInfo: row.contact_info as Record<string, unknown>,
      motivation: row.motivation,
      status: row.status as ApplicationStatus,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : null,
      createdAt: new Date(row.created_at),
    };
  }

  private mapWalletToEntity(row: AgentWalletRow): AgentWalletEntity {
    return {
      id: row.id,
      userId: row.user_id,
      balance: row.balance,
      totalEarned: row.total_earned,
      totalWithdrawn: row.total_withdrawn,
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapWithdrawalToEntity(row: WithdrawalRequestRow): WithdrawalRequestEntity {
    return {
      id: row.id,
      walletId: row.wallet_id,
      userId: row.user_id,
      amount: row.amount,
      paymentMethod: row.payment_method as Record<string, unknown>,
      status: row.status as WithdrawalStatus,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : null,
      createdAt: new Date(row.created_at),
    };
  }

  // ── Applications ─────────────────────────────────────────────────────

  async createApplication(input: {
    userId: string;
    fullName: string;
    university: string;
    contactInfo: Record<string, unknown>;
    motivation: string;
  }): Promise<AgentApplicationEntity> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('agent_applications')
      .insert({
        user_id: input.userId,
        full_name: input.fullName,
        university: input.university,
        contact_info: input.contactInfo as Json,
        motivation: input.motivation,
      })
      .select()
      .single();

    if (error) {
      throw new DatabaseError(`Failed to create agent application: ${error.message}`, error);
    }
    return this.mapApplicationToEntity(data);
  }

  async findApplicationByUserId(userId: string): Promise<AgentApplicationEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('agent_applications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch agent application: ${error.message}`, error);
    }
    if (!data) return null;
    return this.mapApplicationToEntity(data);
  }

  async listApplications(status?: ApplicationStatus): Promise<AgentApplicationEntity[]> {
    const supabase = await createClient();
    let query = supabase
      .from('agent_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(`Failed to list agent applications: ${error.message}`, error);
    }
    return (data ?? []).map((row) => this.mapApplicationToEntity(row));
  }

  async updateApplication(
    id: string,
    updates: { status: ApplicationStatus; reviewedBy: string; reviewedAt: Date },
  ): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('agent_applications')
      .update({
        status: updates.status,
        reviewed_by: updates.reviewedBy,
        reviewed_at: updates.reviewedAt.toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new DatabaseError(`Failed to update agent application: ${error.message}`, error);
    }
  }

  // ── Wallets ──────────────────────────────────────────────────────────

  async findWalletByUserId(userId: string): Promise<AgentWalletEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('agent_wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch agent wallet: ${error.message}`, error);
    }
    if (!data) return null;
    return this.mapWalletToEntity(data);
  }

  async createWallet(userId: string): Promise<AgentWalletEntity> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('agent_wallets')
      .insert({ user_id: userId })
      .select()
      .single();

    if (error) {
      throw new DatabaseError(`Failed to create agent wallet: ${error.message}`, error);
    }
    return this.mapWalletToEntity(data);
  }

  async incrementWalletBalance(userId: string, amount: number): Promise<void> {
    const supabase = await createClient();

    // Read current wallet, then update with incremented values.
    // A Supabase RPC would be ideal for atomicity, but select-then-update
    // is acceptable for MVP given low contention on wallet rows.
    const { data: wallet, error: fetchErr } = await supabase
      .from('agent_wallets')
      .select('balance, total_earned')
      .eq('user_id', userId)
      .single();

    if (fetchErr) {
      throw new DatabaseError(
        `Failed to fetch wallet for increment: ${fetchErr.message}`,
        fetchErr,
      );
    }
    if (!wallet) {
      throw new DatabaseError('Wallet not found for user');
    }

    const { error: updateErr } = await supabase
      .from('agent_wallets')
      .update({
        balance: wallet.balance + amount,
        total_earned: wallet.total_earned + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateErr) {
      throw new DatabaseError(
        `Failed to increment wallet balance: ${updateErr.message}`,
        updateErr,
      );
    }
  }

  // ── Withdrawals ──────────────────────────────────────────────────────

  async listWithdrawals(userId?: string): Promise<WithdrawalRequestEntity[]> {
    const supabase = await createClient();
    let query = supabase
      .from('withdrawal_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(`Failed to list withdrawals: ${error.message}`, error);
    }
    return (data ?? []).map((row) => this.mapWithdrawalToEntity(row));
  }

  async createWithdrawal(input: {
    walletId: string;
    userId: string;
    amount: number;
    paymentMethod: Record<string, unknown>;
  }): Promise<WithdrawalRequestEntity> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .insert({
        wallet_id: input.walletId,
        user_id: input.userId,
        amount: input.amount,
        payment_method: input.paymentMethod as Json,
      })
      .select()
      .single();

    if (error) {
      throw new DatabaseError(`Failed to create withdrawal: ${error.message}`, error);
    }
    return this.mapWithdrawalToEntity(data);
  }

  async updateWithdrawal(
    id: string,
    updates: { status: WithdrawalStatus; reviewedBy?: string; reviewedAt?: Date },
  ): Promise<void> {
    const supabase = await createClient();
    const updateData: Database['public']['Tables']['withdrawal_requests']['Update'] = {
      status: updates.status,
    };
    if (updates.reviewedBy !== undefined) {
      updateData.reviewed_by = updates.reviewedBy;
    }
    if (updates.reviewedAt !== undefined) {
      updateData.reviewed_at = updates.reviewedAt.toISOString();
    }

    const { error } = await supabase.from('withdrawal_requests').update(updateData).eq('id', id);

    if (error) {
      throw new DatabaseError(`Failed to update withdrawal: ${error.message}`, error);
    }
  }
}

let _agentRepository: AgentRepository | null = null;

export function getAgentRepository(): AgentRepository {
  if (!_agentRepository) {
    _agentRepository = new AgentRepository();
  }
  return _agentRepository;
}
