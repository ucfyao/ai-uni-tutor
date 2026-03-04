/**
 * Institution Repository
 *
 * Data access for institutions, members, and invites.
 */

import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/database';
import type {
  AmbassadorStats,
  InstitutionEntity,
  InstitutionInviteEntity,
  InstitutionMemberEntity,
  InstitutionMemberStatus,
} from '@/types/institution';

type InstitutionRow = Database['public']['Tables']['institutions']['Row'];
type MemberRow = Database['public']['Tables']['institution_members']['Row'];
type InviteRow = Database['public']['Tables']['institution_invites']['Row'];

export class InstitutionRepository {
  // ── Mappers ──────────────────────────────────────────────────

  private mapInstitutionToEntity(row: InstitutionRow): InstitutionEntity {
    return {
      id: row.id,
      name: row.name,
      adminId: row.admin_id,
      commissionRate: row.commission_rate,
      contactInfo: row.contact_info as Record<string, unknown>,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapMemberToEntity(row: MemberRow): InstitutionMemberEntity {
    return {
      id: row.id,
      institutionId: row.institution_id,
      userId: row.user_id,
      status: row.status as InstitutionMemberStatus,
      invitedAt: new Date(row.invited_at),
      joinedAt: row.joined_at ? new Date(row.joined_at) : null,
    };
  }

  private mapInviteToEntity(row: InviteRow): InstitutionInviteEntity {
    return {
      id: row.id,
      institutionId: row.institution_id,
      inviteCode: row.invite_code,
      createdBy: row.created_by,
      maxUses: row.max_uses,
      usedCount: row.used_count,
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
    };
  }

  // ── Institutions ─────────────────────────────────────────────

  async createAtomic(input: {
    name: string;
    adminId: string;
    commissionRate?: number;
    contactInfo?: Record<string, unknown>;
  }): Promise<string> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('create_institution', {
      p_name: input.name,
      p_admin_id: input.adminId,
      p_commission_rate: input.commissionRate ?? 0.2,
      p_contact_info: (input.contactInfo ?? {}) as Json,
    });
    if (error) throw new DatabaseError(`Failed to create institution: ${error.message}`, error);
    return data as string;
  }

  async findById(id: string): Promise<InstitutionEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.from('institutions').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch institution: ${error.message}`, error);
    }
    return data ? this.mapInstitutionToEntity(data) : null;
  }

  async findByAdminId(adminId: string): Promise<InstitutionEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('institutions')
      .select('*')
      .eq('admin_id', adminId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch institution by admin: ${error.message}`, error);
    }
    return data ? this.mapInstitutionToEntity(data) : null;
  }

  async listAll(isActive?: boolean): Promise<InstitutionEntity[]> {
    const supabase = await createClient();
    let query = supabase.from('institutions').select('*').order('created_at', { ascending: false });
    if (isActive !== undefined) query = query.eq('is_active', isActive);
    const { data, error } = await query;
    if (error) throw new DatabaseError(`Failed to list institutions: ${error.message}`, error);
    return (data ?? []).map((r) => this.mapInstitutionToEntity(r));
  }

  async update(
    id: string,
    updates: {
      name?: string;
      commissionRate?: number;
      contactInfo?: Record<string, unknown>;
      isActive?: boolean;
    },
  ): Promise<void> {
    const supabase = await createClient();
    const updateData: Database['public']['Tables']['institutions']['Update'] = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.commissionRate !== undefined) updateData.commission_rate = updates.commissionRate;
    if (updates.contactInfo !== undefined) updateData.contact_info = updates.contactInfo as Json;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    const { error } = await supabase.from('institutions').update(updateData).eq('id', id);
    if (error) throw new DatabaseError(`Failed to update institution: ${error.message}`, error);
  }

  // ── Members ──────────────────────────────────────────────────

  async listMembers(institutionId: string): Promise<InstitutionMemberEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('institution_members')
      .select('*')
      .eq('institution_id', institutionId)
      .order('invited_at', { ascending: false });
    if (error) throw new DatabaseError(`Failed to list members: ${error.message}`, error);
    return (data ?? []).map((r) => this.mapMemberToEntity(r));
  }

  async findMemberByUserId(userId: string): Promise<InstitutionMemberEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('institution_members')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch member: ${error.message}`, error);
    }
    return data ? this.mapMemberToEntity(data) : null;
  }

  async acceptInviteAtomic(inviteCode: string): Promise<string> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('accept_institution_invite', {
      p_invite_code: inviteCode,
    });
    if (error) {
      if (error.message.includes('not found')) throw new Error('Invite not found');
      if (error.message.includes('no longer active')) throw new Error('Invite is no longer active');
      if (error.message.includes('expired')) throw new Error('Invite has expired');
      if (error.message.includes('maximum uses'))
        throw new Error('Invite has reached maximum uses');
      if (error.message.includes('Already a member'))
        throw new Error('Already a member of this institution');
      if (error.message.includes('admin cannot join'))
        throw new Error('Institution admin cannot join as ambassador');
      throw new DatabaseError(`Failed to accept invite: ${error.message}`, error);
    }
    return data as string;
  }

  async removeMemberAtomic(institutionId: string, userId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.rpc('remove_institution_member', {
      p_institution_id: institutionId,
      p_user_id: userId,
    });
    if (error) throw new DatabaseError(`Failed to remove member: ${error.message}`, error);
  }

  async getAmbassadorStats(institutionId: string): Promise<AmbassadorStats[]> {
    const supabase = await createClient();

    // 1 query for members+profiles (join via foreign key)
    const { data: members, error: membersError } = await supabase
      .from('institution_members')
      .select('user_id, status, joined_at, profiles!inner(full_name, email)')
      .eq('institution_id', institutionId)
      .neq('status', 'removed');
    if (membersError)
      throw new DatabaseError(
        `Failed to fetch ambassador stats: ${membersError.message}`,
        membersError,
      );

    const memberUserIds = (members ?? []).map((m) => m.user_id);
    if (memberUserIds.length === 0) return [];

    // 1 query for all referral counts grouped by referrer
    const { data: referrals, error: refError } = await supabase
      .from('referrals')
      .select('referrer_id, status')
      .in('referrer_id', memberUserIds);
    if (refError)
      throw new DatabaseError(`Failed to fetch referral counts: ${refError.message}`, refError);

    // Aggregate client-side
    const countMap = new Map<string, { total: number; paid: number }>();
    for (const r of referrals ?? []) {
      const entry = countMap.get(r.referrer_id) ?? { total: 0, paid: 0 };
      entry.total++;
      if (r.status === 'paid' || r.status === 'rewarded') entry.paid++;
      countMap.set(r.referrer_id, entry);
    }

    return (members ?? []).map((m) => {
      const profile = m.profiles as unknown as { full_name: string | null; email: string | null };
      const counts = countMap.get(m.user_id) ?? { total: 0, paid: 0 };
      return {
        userId: m.user_id,
        fullName: profile?.full_name ?? null,
        email: profile?.email ?? null,
        referralCount: counts.total,
        paidCount: counts.paid,
        status: m.status as InstitutionMemberStatus,
        joinedAt: m.joined_at ? new Date(m.joined_at) : null,
      };
    });
  }

  // ── Invites ──────────────────────────────────────────────────

  async createInvite(input: {
    institutionId: string;
    inviteCode: string;
    createdBy: string;
    maxUses?: number;
    expiresAt?: Date;
  }): Promise<InstitutionInviteEntity> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('institution_invites')
      .insert({
        institution_id: input.institutionId,
        invite_code: input.inviteCode,
        created_by: input.createdBy,
        max_uses: input.maxUses,
        expires_at: input.expiresAt?.toISOString(),
      })
      .select()
      .single();
    if (error) throw new DatabaseError(`Failed to create invite: ${error.message}`, error);
    return this.mapInviteToEntity(data);
  }

  async listInvites(institutionId: string): Promise<InstitutionInviteEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('institution_invites')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false });
    if (error) throw new DatabaseError(`Failed to list invites: ${error.message}`, error);
    return (data ?? []).map((r) => this.mapInviteToEntity(r));
  }

  async findInviteByCode(code: string): Promise<InstitutionInviteEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('institution_invites')
      .select('*')
      .eq('invite_code', code)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch invite: ${error.message}`, error);
    }
    return data ? this.mapInviteToEntity(data) : null;
  }

  async toggleInvite(id: string, isActive: boolean): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('institution_invites')
      .update({ is_active: isActive })
      .eq('id', id);
    if (error) throw new DatabaseError(`Failed to toggle invite: ${error.message}`, error);
  }
}

let _institutionRepository: InstitutionRepository | null = null;

export function getInstitutionRepository(): InstitutionRepository {
  if (!_institutionRepository) {
    _institutionRepository = new InstitutionRepository();
  }
  return _institutionRepository;
}
