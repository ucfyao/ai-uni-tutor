/**
 * Repository Interface - Session Repository
 *
 * Defines the contract for session data access operations.
 * Implementations can use Supabase, Prisma, or any other data store.
 */

import type { CreateSessionDTO, SessionEntity, UpdateSessionDTO } from '../models/Session';

export interface ISessionRepository {
  // Read operations
  findByIdAndUserId(id: string, userId: string): Promise<SessionEntity | null>;
  findAllByUserId(userId: string): Promise<SessionEntity[]>;
  findSharedById(id: string): Promise<SessionEntity | null>;

  // Write operations
  create(data: CreateSessionDTO): Promise<SessionEntity>;
  update(id: string, data: UpdateSessionDTO): Promise<void>;
  delete(id: string): Promise<void>;

  // Ownership check
  verifyOwnership(id: string, userId: string): Promise<boolean>;
}
