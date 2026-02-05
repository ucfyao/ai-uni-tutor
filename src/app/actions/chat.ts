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
import { QuotaExceededError } from '@/lib/errors';
import { getChatService } from '@/lib/services/ChatService';
import { getQuotaService } from '@/lib/services/QuotaService';
import { getSessionService } from '@/lib/services/SessionService';
import { getCurrentUser } from '@/lib/supabase/server';
import { ChatMessage, ChatSession, Course, TutoringMode } from '@/types/index';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const tutoringModeSchema = z.enum(['Lecture Helper', 'Assignment Coach', 'Exam Prep']);

const courseSchema = z.object({
  id: z.string().min(1),
  universityId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
});

const chatMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
  timestamp: z.number().finite(),
  cardId: z.string().min(1).optional(),
});

const generateChatSchema = z.object({
  course: courseSchema,
  mode: tutoringModeSchema,
  history: z.array(chatMessageSchema),
  userInput: z.string().min(1),
});

const sessionIdSchema = z.string().min(1);

const createSessionSchema = z
  .object({
    course: courseSchema,
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

const explainConceptSchema = z.object({
  concept: z.string().min(1),
  context: z.string().min(1),
  courseCode: z.string().min(1).optional(),
});

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export type ChatActionResponse =
  | { success: true; data: string }
  | { success: false; error: string; isLimitError?: boolean };

export type ExplainConceptResponse =
  | { success: true; explanation: string }
  | { success: false; error: string };

// ============================================================================
// AI GENERATION ACTIONS
// ============================================================================

/**
 * Generate AI chat response using Strategy pattern
 */
export async function generateChatResponse(
  course: Course,
  mode: TutoringMode | null,
  history: ChatMessage[],
  userInput: string,
): Promise<ChatActionResponse> {
  try {
    // Validation (Zod)
    const parsed = generateChatSchema.safeParse({ course, mode, history, userInput });
    if (!parsed.success) {
      // Provide a specific error when mode is missing/invalid
      const hasModeError = parsed.error.issues.some((issue) => issue.path[0] === 'mode');
      if (hasModeError) {
        throw new Error('Tutoring Mode must be selected');
      }
      throw new Error('Validation Failed: Invalid chat request payload.');
    }

    // Auth
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    // Quota Check
    const quotaService = getQuotaService();
    await quotaService.enforce();

    // Delegate to ChatService (uses Strategy pattern internally)
    const chatService = getChatService();
    const response = await chatService.generateResponse({
      course: parsed.data.course,
      mode: parsed.data.mode,
      history: parsed.data.history,
      userInput: parsed.data.userInput,
    });

    return { success: true, data: response };
  } catch (error: unknown) {
    return handleChatError(error);
  }
}

/**
 * Explain a concept for knowledge cards
 */
export async function explainConcept(
  concept: string,
  context: string,
  courseCode?: string,
): Promise<ExplainConceptResponse> {
  try {
    const parsed = explainConceptSchema.safeParse({ concept, context, courseCode });
    if (!parsed.success) {
      return { success: false, error: 'Invalid explain concept payload.' };
    }

    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    // Quota Check
    const quotaService = getQuotaService();
    await quotaService.enforce();

    // Delegate to ChatService
    const chatService = getChatService();
    const explanation = await chatService.explainConcept(concept, context, courseCode);

    return { success: true, explanation };
  } catch (error: unknown) {
    if (error instanceof QuotaExceededError) {
      return { success: false, error: error.message };
    }

    console.error('explainConcept error:', error);
    const message = error instanceof Error ? error.message : 'Failed to explain concept';
    return { success: false, error: message };
  }
}

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
export async function createChatSession(
  session: Omit<ChatSession, 'id' | 'lastUpdated'>,
): Promise<ChatSession> {
  const parsed = createSessionSchema.safeParse(session);
  if (!parsed.success) {
    throw new Error('Validation Failed: Invalid chat session payload.');
  }

  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const sessionService = getSessionService();
  return sessionService.createSession(user.id, session.course, session.mode, session.title);
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

// ============================================================================
// ERROR HANDLING
// ============================================================================

function handleChatError(error: unknown): ChatActionResponse {
  // Quota Exceeded: trigger UI Modal
  if (error instanceof QuotaExceededError) {
    return { success: false, error: error.message, isLimitError: true };
  }

  // Business Logic Errors: Propagate message
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes('Validation Failed') ||
    message.includes('Unauthorized') ||
    message.includes('Tutoring Mode must be selected') ||
    message.includes('Invalid Course Context')
  ) {
    return { success: false, error: message };
  }

  // Technical/Third-Party Errors: Log and Mask
  console.error('Internal/Third-Party Error:', error);
  return {
    success: false,
    error: 'An unexpected error occurred with the AI service. Please contact the administrator.',
  };
}
