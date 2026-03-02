import type { CardConversationEntity, CreateCardConversationDTO } from '@/types/card-conversation';

export interface ICardConversationRepository {
  findByCardId(cardId: string, cardType: 'knowledge' | 'user'): Promise<CardConversationEntity[]>;
  create(dto: CreateCardConversationDTO): Promise<CardConversationEntity>;
}
