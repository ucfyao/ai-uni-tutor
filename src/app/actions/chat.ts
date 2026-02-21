'use server';

/**
 * Chat Server Actions
 *
 * Thin wrappers that delegate to Service layer.
 * Handles authentication, validation, and error mapping.
 *
 * Architecture: Actions → Services → Repositories → Database
 */
import { z } from 'zod';
import { getSessionService } from '@/lib/services/SessionService';
import { getCurrentUser } from '@/lib/supabase/server';
import { ChatMessage, ChatSession, TutoringMode } from '@/types/index';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const tutoringModeSchema = z.enum(['Lecture Helper', 'Assignment Coach', 'Mock Exam']);

const courseIdSchema = z.string().uuid();

const chatMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
  timestamp: z.number().finite(),
});

const sessionIdSchema = z.string().min(1);

const createSessionSchema = z
  .object({
    courseId: courseIdSchema,
    mode: tutoringModeSchema.nullable(),
    title: z.string().min(1),
  })
  .passthrough();

const saveMessageSchema = z.object({
  sessionId: sessionIdSchema,
  message: chatMessageSchema,
});

const togglePinSchema = z.object({
  sessionId: sessionIdSchema,
  isPinned: z.boolean(),
});

const updateTitleSchema = z.object({
  sessionId: sessionIdSchema,
  title: z.string().min(1).max(200),
});

const updateModeSchema = z.object({
  sessionId: sessionIdSchema,
  mode: tutoringModeSchema,
});

const toggleShareSchema = z.object({
  sessionId: sessionIdSchema,
  isShared: z.boolean(),
});

// ============================================================================
// SESSION CRUD ACTIONS
// ============================================================================

/**
 * Get a single session with messages
 */
export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success) return null;

  const user = await getCurrentUser();
  if (!user) return null;

  const sessionService = getSessionService();
  return sessionService.getFullSession(sessionId, user.id);
}

/**
 * Get only messages for a session
 */
export async function getChatMessages(sessionId: string): Promise<ChatMessage[] | null> {
  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success) return null;

  const user = await getCurrentUser();
  if (!user) return null;

  const sessionService = getSessionService();
  return sessionService.getSessionMessages(sessionId, user.id);
}

/**
 * Get all sessions for sidebar (without messages)
 */
export async function getChatSessions(): Promise<ChatSession[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const sessionService = getSessionService();
  return sessionService.getUserSessions(user.id);
}

/**
 * Get a shared session (public access)
 */
export async function getSharedSession(sessionId: string): Promise<ChatSession | null> {
  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success) return null;

  const sessionService = getSessionService();
  return sessionService.getSharedSession(sessionId);
}

/**
 * Create a new session
 */
export async function createChatSession(session: {
  courseId: string;
  mode: TutoringMode | null;
  title: string;
}): Promise<ChatSession> {
  const parsed = createSessionSchema.safeParse(session);
  if (!parsed.success) {
    throw new Error('Validation Failed: Invalid chat session payload.');
  }

  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const sessionService = getSessionService();
  return sessionService.createSession(
    user.id,
    parsed.data.courseId,
    parsed.data.mode,
    parsed.data.title,
  );
}

/**
 * Save a message to a session
 */
export async function saveChatMessage(sessionId: string, message: ChatMessage): Promise<void> {
  const parsed = saveMessageSchema.safeParse({ sessionId, message });
  if (!parsed.success) {
    throw new Error('Validation Failed: Invalid chat message payload.');
  }

  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const sessionService = getSessionService();
  await sessionService.saveMessage(sessionId, user.id, message);
}

/**
 * Update session title
 */
export async function updateChatSessionTitle(sessionId: string, title: string): Promise<void> {
  const parsed = updateTitleSchema.safeParse({ sessionId, title });
  if (!parsed.success) {
    throw new Error('Validation Failed: Invalid title payload.');
  }

  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const sessionService = getSessionService();
  await sessionService.updateTitle(sessionId, user.id, title);
}

/**
 * Update session mode
 */
export async function updateChatSessionMode(sessionId: string, mode: TutoringMode): Promise<void> {
  const parsed = updateModeSchema.safeParse({ sessionId, mode });
  if (!parsed.success) {
    throw new Error('Validation Failed: Invalid mode payload.');
  }

  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const sessionService = getSessionService();
  await sessionService.updateMode(sessionId, user.id, mode);
}

/**
 * Toggle session pin status
 */
export async function toggleSessionPin(sessionId: string, isPinned: boolean): Promise<void> {
  const parsed = togglePinSchema.safeParse({ sessionId, isPinned });
  if (!parsed.success) {
    throw new Error('Validation Failed: Invalid pin toggle payload.');
  }

  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const sessionService = getSessionService();
  await sessionService.togglePin(sessionId, user.id, isPinned);
}

/**
 * Toggle session share status
 */
export async function toggleSessionShare(sessionId: string, isShared: boolean): Promise<void> {
  const parsed = toggleShareSchema.safeParse({ sessionId, isShared });
  if (!parsed.success) {
    throw new Error('Validation Failed: Invalid share toggle payload.');
  }

  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const sessionService = getSessionService();
  await sessionService.toggleShare(sessionId, user.id, isShared);
}

/**
 * Delete a session
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success) {
    throw new Error('Validation Failed: Invalid session id.');
  }

  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const sessionService = getSessionService();
  await sessionService.deleteSession(sessionId, user.id);
}
