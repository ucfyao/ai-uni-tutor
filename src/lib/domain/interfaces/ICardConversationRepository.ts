import type { CardConversationEntity, CreateCardConversationDTO } from '../models/CardConversation';

export interface ICardConversationRepository {
  findByCardId(cardId: string, cardType: 'knowledge' | 'user'): Promise<CardConversationEntity[]>;
  create(dto: CreateCardConversationDTO): Promise<CardConversationEntity>;
}
