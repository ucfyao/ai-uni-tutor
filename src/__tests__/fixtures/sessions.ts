/**
 * Test Fixtures - Sessions
 *
 * Matches SessionEntity from src/lib/domain/models/Session.ts
 * and the chat_sessions table Row from src/types/database.ts.
 */

import type { SessionEntity } from '@/lib/domain/models/Session';
import type { Course, TutoringMode } from '@/types';

/* ---------- Shared course fixture ---------- */

export const testCourse: Course = {
  id: 'course-001',
  universityId: 'uni-001',
  code: 'CS101',
  name: 'Introduction to Computer Science',
};

/* ---------- Database row (snake_case) ---------- */

export const sessionRow = {
  id: 'session-001',
  user_id: 'user-free-001',
  course: testCourse,
  mode: 'Lecture Helper' as string | null,
  title: 'My First Session',
  is_pinned: false,
  is_shared: false,
  share_expires_at: null as string | null,
  created_at: '2025-06-01T10:00:00Z',
  updated_at: '2025-06-01T12:00:00Z',
};

/* ---------- Domain entity (camelCase) ---------- */

export const sessionEntity: SessionEntity = {
  id: sessionRow.id,
  userId: sessionRow.user_id,
  course: sessionRow.course,
  mode: sessionRow.mode as TutoringMode | null,
  title: sessionRow.title,
  isPinned: sessionRow.is_pinned,
  isShared: sessionRow.is_shared,
  shareExpiresAt: null,
  createdAt: new Date(sessionRow.created_at),
  updatedAt: new Date(sessionRow.updated_at),
};

/* ---------- Variants ---------- */

export const pinnedSessionRow = {
  ...sessionRow,
  id: 'session-002',
  title: 'Pinned Session',
  is_pinned: true,
};

export const sharedSessionRow = {
  ...sessionRow,
  id: 'session-003',
  title: 'Shared Session',
  is_shared: true,
  share_expires_at: '2026-12-31T23:59:59Z',
};
