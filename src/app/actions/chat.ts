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
import { mapError } from '@/lib/errors';
import { getKnowledgeCardService } from '@/lib/services/KnowledgeCardService';
import { getSessionService } from '@/lib/services/SessionService';
import { getCurrentUser } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/actions';
import type { CardConversationEntity } from '@/types/card-conversation';
import { ChatMessage, ChatSession, TutoringMode } from '@/types/index';
import type { UserCardEntity } from '@/types/user-card';

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
  parentMessageId: z.string().nullable().optional(),
});

const sessionIdSchema = z.string().uuid();

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
export async function getChatSession(sessionId: string): Promise<ActionResult<ChatSession | null>> {
  try {
    const parsed = sessionIdSchema.safeParse(sessionId);
    if (!parsed.success) return { success: false, error: 'Invalid session ID', code: 'VALIDATION' };

    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

    const sessionService = getSessionService();
    const data = await sessionService.getFullSession(sessionId, user.id);
    return { success: true, data };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Get a session with messages AND user knowledge cards in a single request.
 * Avoids multiple round-trips (session + cards = 1 auth check, 1 request).
 */
export async function getSessionWithCards(sessionId: string): Promise<
  ActionResult<{
    session: ChatSession;
    userCards: UserCardEntity[];
    cardChats: Record<string, CardConversationEntity[]>;
  } | null>
> {
  try {
    const parsed = sessionIdSchema.safeParse(sessionId);
    if (!parsed.success) return { success: false, error: 'Invalid session ID', code: 'VALIDATION' };

    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

    const sessionService = getSessionService();
    const cardService = getKnowledgeCardService();

    const [session, userCards] = await Promise.all([
      sessionService.getFullSession(sessionId, user.id),
      cardService.getUserCards(user.id, sessionId),
    ]);

    if (!session) return { success: true, data: null };

    // Pre-fetch all card conversations in parallel
    const chatEntries = await Promise.all(
      userCards.map(async (card) => {
        const convos = await cardService.getCardConversations(card.id, 'user');
        return [card.id, convos] as const;
      }),
    );
    const cardChats: Record<string, CardConversationEntity[]> = Object.fromEntries(chatEntries);

    return { success: true, data: { session, userCards, cardChats } };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Get only messages for a session
 */
export async function getChatMessages(
  sessionId: string,
): Promise<ActionResult<ChatMessage[] | null>> {
  try {
    const parsed = sessionIdSchema.safeParse(sessionId);
    if (!parsed.success) return { success: false, error: 'Invalid session ID', code: 'VALIDATION' };

    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

    const sessionService = getSessionService();
    const data = await sessionService.getSessionMessages(sessionId, user.id);
    return { success: true, data };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Get all sessions for sidebar (without messages)
 */
export async function getChatSessions(): Promise<ActionResult<ChatSession[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

    const sessionService = getSessionService();
    const data = await sessionService.getUserSessions(user.id);
    return { success: true, data };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Get a shared session (public access)
 */
export async function getSharedSession(
  sessionId: string,
): Promise<ActionResult<ChatSession | null>> {
  try {
    const parsed = sessionIdSchema.safeParse(sessionId);
    if (!parsed.success) return { success: false, error: 'Invalid session ID', code: 'VALIDATION' };

    const sessionService = getSessionService();
    const data = await sessionService.getSharedSession(sessionId);
    return { success: true, data };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Create a new session
 */
export async function createChatSession(session: {
  courseId: string;
  mode: TutoringMode | null;
  title: string;
}): Promise<ActionResult<ChatSession>> {
  try {
    const parsed = createSessionSchema.safeParse(session);
    if (!parsed.success)
      return { success: false, error: 'Invalid chat session payload', code: 'VALIDATION' };

    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

    const sessionService = getSessionService();
    const data = await sessionService.createSession(
      user.id,
      parsed.data.courseId,
      parsed.data.mode,
      parsed.data.title,
    );
    return { success: true, data };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Save a message to a session
 */
export async function saveChatMessage(
  sessionId: string,
  message: ChatMessage,
): Promise<ActionResult<void>> {
  try {
    const parsed = saveMessageSchema.safeParse({ sessionId, message });
    if (!parsed.success)
      return { success: false, error: 'Invalid chat message payload', code: 'VALIDATION' };

    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

    const sessionService = getSessionService();
    await sessionService.saveMessage(sessionId, user.id, message);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Update session title
 */
export async function updateChatSessionTitle(
  sessionId: string,
  title: string,
): Promise<ActionResult<void>> {
  try {
    const parsed = updateTitleSchema.safeParse({ sessionId, title });
    if (!parsed.success)
      return { success: false, error: 'Invalid title payload', code: 'VALIDATION' };

    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

    const sessionService = getSessionService();
    await sessionService.updateTitle(sessionId, user.id, title);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Update session mode
 */
export async function updateChatSessionMode(
  sessionId: string,
  mode: TutoringMode,
): Promise<ActionResult<void>> {
  try {
    const parsed = updateModeSchema.safeParse({ sessionId, mode });
    if (!parsed.success)
      return { success: false, error: 'Invalid mode payload', code: 'VALIDATION' };

    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

    const sessionService = getSessionService();
    await sessionService.updateMode(sessionId, user.id, mode);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Update activeLeafId (lightweight — used by client-side branch switching)
 */
export async function updateActiveLeaf(
  sessionId: string,
  leafId: string,
): Promise<ActionResult<void>> {
  try {
    const parsed = sessionIdSchema.safeParse(sessionId);
    if (!parsed.success) return { success: false, error: 'Invalid session ID', code: 'VALIDATION' };

    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

    const { getSessionRepository } = await import('@/lib/repositories');
    const sessionRepo = getSessionRepository();
    const hasAccess = await sessionRepo.verifyOwnership(sessionId, user.id);
    if (!hasAccess) return { success: false, error: 'Forbidden', code: 'FORBIDDEN' };

    await sessionRepo.update(sessionId, { activeLeafId: leafId });
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Toggle session pin status
 */
export async function toggleSessionPin(
  sessionId: string,
  isPinned: boolean,
): Promise<ActionResult<void>> {
  try {
    const parsed = togglePinSchema.safeParse({ sessionId, isPinned });
    if (!parsed.success)
      return { success: false, error: 'Invalid pin toggle payload', code: 'VALIDATION' };

    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

    const sessionService = getSessionService();
    await sessionService.togglePin(sessionId, user.id, isPinned);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Toggle session share status
 */
export async function toggleSessionShare(
  sessionId: string,
  isShared: boolean,
): Promise<ActionResult<void>> {
  try {
    const parsed = toggleShareSchema.safeParse({ sessionId, isShared });
    if (!parsed.success)
      return { success: false, error: 'Invalid share toggle payload', code: 'VALIDATION' };

    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

    const sessionService = getSessionService();
    await sessionService.toggleShare(sessionId, user.id, isShared);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Delete a session
 */
export async function deleteChatSession(sessionId: string): Promise<ActionResult<void>> {
  try {
    const parsed = sessionIdSchema.safeParse(sessionId);
    if (!parsed.success) return { success: false, error: 'Invalid session ID', code: 'VALIDATION' };

    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

    const sessionService = getSessionService();
    await sessionService.deleteSession(sessionId, user.id);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

// ============================================================================
// BRANCHING ACTIONS
// ============================================================================

const editAndRegenerateSchema = z.object({
  sessionId: sessionIdSchema,
  messageId: z.string().min(1),
  newContent: z.string().min(1),
});

/**
 * Edit a user message and create a new conversation branch.
 * Returns the new branch ID, updated active-path messages, and siblingsMap.
 */
export async function editAndRegenerate(
  sessionId: string,
  messageId: string,
  newContent: string,
): Promise<
  ActionResult<{
    newMessageId: string;
    messages: ChatMessage[];
    siblingsMap: Record<string, string[]>;
  }>
> {
  try {
    const parsed = editAndRegenerateSchema.safeParse({ sessionId, messageId, newContent });
    if (!parsed.success)
      return { success: false, error: 'Invalid edit payload', code: 'VALIDATION' };

    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

    const sessionService = getSessionService();
    const data = await sessionService.editAndRegenerate(sessionId, user.id, messageId, newContent);
    return { success: true, data };
  } catch (error) {
    return mapError(error);
  }
}

const switchBranchSchema = z.object({
  sessionId: sessionIdSchema,
  parentMessageId: z.string().min(1),
  targetChildId: z.string().min(1),
});

/**
 * Switch to a different conversation branch at a fork point.
 * Returns updated active-path messages and siblingsMap.
 */
export async function switchBranch(
  sessionId: string,
  parentMessageId: string,
  targetChildId: string,
): Promise<
  ActionResult<{ messages: ChatMessage[]; siblingsMap: Record<string, string[]> } | null>
> {
  try {
    const parsed = switchBranchSchema.safeParse({ sessionId, parentMessageId, targetChildId });
    if (!parsed.success)
      return { success: false, error: 'Invalid branch switch payload', code: 'VALIDATION' };

    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

    const sessionService = getSessionService();
    const data = await sessionService.switchBranch(
      sessionId,
      user.id,
      parentMessageId,
      targetChildId,
    );
    return { success: true, data };
  } catch (error) {
    return mapError(error);
  }
}
