/**
 * Domain Models - Session Entity
 *
 * Represents a chat session in the domain layer.
 * Independent of database implementation.
 */

import { Course, TutoringMode } from '@/types';

export interface SessionEntity {
  id: string;
  userId: string;
  course: Course;
  mode: TutoringMode | null;
  title: string;
  isPinned: boolean;
  isShared: boolean;
  shareExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionDTO {
  userId: string;
  course: Course;
  mode: TutoringMode | null;
  title: string;
}

export interface UpdateSessionDTO {
  title?: string;
  mode?: TutoringMode;
  isPinned?: boolean;
  isShared?: boolean;
  shareExpiresAt?: Date | null;
}
