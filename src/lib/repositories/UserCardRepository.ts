/**
 * User Card Repository Implementation
 *
 * Supabase-based implementation of IUserCardRepository.
 * Handles per-user card operations (cards created from text selection).
 */

import type { IUserCardRepository } from '@/lib/domain/interfaces/IUserCardRepository';
import type { CreateUserCardDTO, UserCardEntity } from '@/lib/domain/models/UserCard';
import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type UserCardRow = Database['public']['Tables']['user_cards']['Row'];

export class UserCardRepository implements IUserCardRepository {
  private mapToEntity(row: UserCardRow): UserCardEntity {
    return {
      id: row.id,
      userId: row.user_id,
      sessionId: row.session_id,
      title: row.title,
      content: row.content,
      excerpt: row.excerpt,
      sourceMessageId: row.source_message_id,
      sourceRole: row.source_role,
      createdAt: new Date(row.created_at),
    };
  }

  async findByUserId(userId: string): Promise<UserCardEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('user_cards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error)
      throw new DatabaseError(`Failed to fetch user cards: ${error.message}`, error);
    return (data ?? []).map((row) => this.mapToEntity(row));
  }

  async findBySessionId(sessionId: string, userId: string): Promise<UserCardEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('user_cards')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error)
      throw new DatabaseError(`Failed to fetch user cards by session: ${error.message}`, error);
    return (data ?? []).map((row) => this.mapToEntity(row));
  }

  async create(dto: CreateUserCardDTO): Promise<UserCardEntity> {
    const supabase = await createClient();
    const insertData: Database['public']['Tables']['user_cards']['Insert'] = {
      user_id: dto.userId,
      session_id: dto.sessionId ?? null,
      title: dto.title,
      content: dto.content ?? '',
      excerpt: dto.excerpt ?? '',
      source_message_id: dto.sourceMessageId ?? null,
      source_role: dto.sourceRole ?? null,
    };

    const { data, error } = await supabase
      .from('user_cards')
      .insert(insertData)
      .select()
      .single();

    if (error || !data)
      throw new DatabaseError(`Failed to create user card: ${error?.message}`, error);
    return this.mapToEntity(data);
  }

  async delete(id: string, userId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('user_cards')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error)
      throw new DatabaseError(`Failed to delete user card: ${error.message}`, error);
  }
}

let _userCardRepository: UserCardRepository | null = null;

export function getUserCardRepository(): UserCardRepository {
  if (!_userCardRepository) {
    _userCardRepository = new UserCardRepository();
  }
  return _userCardRepository;
}
