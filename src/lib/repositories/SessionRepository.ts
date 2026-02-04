/**
 * Session Repository Implementation
 *
 * Supabase-based implementation of ISessionRepository.
 * Handles all session-related database operations.
 */

import type { ISessionRepository } from '@/lib/domain/interfaces/ISessionRepository';
import type {
  CreateSessionDTO,
  SessionEntity,
  UpdateSessionDTO,
} from '@/lib/domain/models/Session';
import { createClient } from '@/lib/supabase/server';

// Database row type (matches Supabase schema)
interface SessionRow {
  id: string;
  user_id: string;
  course: {
    id: string;
    universityId: string;
    code: string;
    name: string;
  };
  mode: string | null;
  title: string;
  is_pinned: boolean;
  is_shared: boolean;
  share_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export class SessionRepository implements ISessionRepository {
  /**
   * Map database row to domain entity
   */
  private mapToEntity(row: SessionRow): SessionEntity {
    return {
      id: row.id,
      userId: row.user_id,
      course: row.course,
      mode: row.mode as SessionEntity['mode'],
      title: row.title,
      isPinned: row.is_pinned,
      isShared: row.is_shared,
      shareExpiresAt: row.share_expires_at ? new Date(row.share_expires_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async findById(id: string): Promise<SessionEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.from('chat_sessions').select('*').eq('id', id).single();

    if (error || !data) return null;
    return this.mapToEntity(data as SessionRow);
  }

  async findByIdAndUserId(id: string, userId: string): Promise<SessionEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return this.mapToEntity(data as SessionRow);
  }

  async findAllByUserId(userId: string): Promise<SessionEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error || !data) return [];
    return (data as SessionRow[]).map((row) => this.mapToEntity(row));
  }

  async findSharedById(id: string): Promise<SessionEntity | null> {
    const supabase = await createClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', id)
      .eq('is_shared', true)
      .or(`share_expires_at.is.null,share_expires_at.gt.${now}`)
      .single();

    if (error || !data) return null;
    return this.mapToEntity(data as SessionRow);
  }

  async create(dto: CreateSessionDTO): Promise<SessionEntity> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: dto.userId,
        course: dto.course,
        mode: dto.mode,
        title: dto.title,
        is_pinned: false,
        is_shared: false,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create session: ${error.message}`);
    return this.mapToEntity(data as SessionRow);
  }

  async update(id: string, dto: UpdateSessionDTO): Promise<void> {
    const supabase = await createClient();

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.mode !== undefined) updates.mode = dto.mode;
    if (dto.isPinned !== undefined) updates.is_pinned = dto.isPinned;
    if (dto.isShared !== undefined) updates.is_shared = dto.isShared;
    if (dto.shareExpiresAt !== undefined) {
      updates.share_expires_at = dto.shareExpiresAt?.toISOString() ?? null;
    }

    const { error } = await supabase.from('chat_sessions').update(updates).eq('id', id);

    if (error) throw new Error(`Failed to update session: ${error.message}`);
  }

  async delete(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('chat_sessions').delete().eq('id', id);

    if (error) throw new Error(`Failed to delete session: ${error.message}`);
  }

  async verifyOwnership(id: string, userId: string): Promise<boolean> {
    const session = await this.findByIdAndUserId(id, userId);
    return session !== null;
  }
}

// Singleton instance for convenience
let _sessionRepository: SessionRepository | null = null;

export function getSessionRepository(): SessionRepository {
  if (!_sessionRepository) {
    _sessionRepository = new SessionRepository();
  }
  return _sessionRepository;
}
