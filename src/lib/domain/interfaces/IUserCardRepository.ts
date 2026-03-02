import type { CreateUserCardDTO, UserCardEntity } from '@/types/user-card';

export interface IUserCardRepository {
  findByUserId(userId: string): Promise<UserCardEntity[]>;
  findBySessionId(sessionId: string, userId: string): Promise<UserCardEntity[]>;
  create(dto: CreateUserCardDTO): Promise<UserCardEntity>;
  delete(id: string, userId: string): Promise<void>;
}
