/**
 * Card Conversation Repository Implementation
 *
 * Supabase-based implementation of ICardConversationRepository.
 * Handles card follow-up Q&A messages for analytics.
 */

import type { ICardConversationRepository } from '@/lib/domain/interfaces/ICardConversationRepository';
import type {
  CardConversationEntity,
  CreateCardConversationDTO,
} from '@/lib/domain/models/CardConversation';
import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type CardConversationRow = Database['public']['Tables']['card_conversations']['Row'];

export class CardConversationRepository implements ICardConversationRepository {
  private mapToEntity(row: CardConversationRow): CardConversationEntity {
    return {
      id: row.id,
      cardId: row.card_id,
      cardType: row.card_type,
      userId: row.user_id,
      sessionId: row.session_id,
      courseCode: row.course_code,
      role: row.role,
      content: row.content,
      createdAt: new Date(row.created_at),
    };
  }

  async findByCardId(
    cardId: string,
    cardType: 'knowledge' | 'user',
  ): Promise<CardConversationEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('card_conversations')
      .select('*')
      .eq('card_id', cardId)
      .eq('card_type', cardType)
      .order('created_at', { ascending: true });

    if (error)
      throw new DatabaseError(`Failed to fetch card conversations: ${error.message}`, error);
    return (data ?? []).map((row) => this.mapToEntity(row));
  }

  async create(dto: CreateCardConversationDTO): Promise<CardConversationEntity> {
    const supabase = await createClient();
    const insertData: Database['public']['Tables']['card_conversations']['Insert'] = {
      card_id: dto.cardId,
      card_type: dto.cardType,
      user_id: dto.userId,
      session_id: dto.sessionId ?? null,
      course_code: dto.courseCode ?? null,
      role: dto.role,
      content: dto.content,
    };

    const { data, error } = await supabase
      .from('card_conversations')
      .insert(insertData)
      .select()
      .single();

    if (error || !data)
      throw new DatabaseError(`Failed to create card conversation: ${error?.message}`, error);
    return this.mapToEntity(data);
  }
}

let _cardConversationRepository: CardConversationRepository | null = null;

export function getCardConversationRepository(): CardConversationRepository {
  if (!_cardConversationRepository) {
    _cardConversationRepository = new CardConversationRepository();
  }
  return _cardConversationRepository;
}
