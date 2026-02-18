'use server';

/**
 * Knowledge Card Server Actions
 *
 * Thin wrappers that delegate to KnowledgeCardService + ChatService.
 * Handles authentication, validation, and error mapping.
 *
 * Architecture: Actions → Services → Repositories → Database
 */
import { z } from 'zod';
import type { CardConversationEntity } from '@/lib/domain/models/CardConversation';
import type { KnowledgeCardSummary } from '@/lib/domain/models/KnowledgeCard';
import type { UserCardEntity } from '@/lib/domain/models/UserCard';
import { QuotaExceededError } from '@/lib/errors';
import { getChatService } from '@/lib/services/ChatService';
import { getKnowledgeCardService } from '@/lib/services/KnowledgeCardService';
import { getQuotaService } from '@/lib/services/QuotaService';
import { getCurrentUser } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/actions';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const fetchRelatedCardsSchema = z.object({
  query: z.string().min(1).max(2000),
  matchCount: z.number().int().min(1).max(20).optional(),
});

const fetchUserCardsSchema = z.object({
  sessionId: z.string().min(1).optional(),
});

const createUserCardSchema = z.object({
  sessionId: z.string().min(1).optional(),
  title: z.string().min(1).max(500),
  content: z.string().max(10000).optional(),
  excerpt: z.string().max(5000).optional(),
  sourceMessageId: z.string().min(1).optional(),
  sourceRole: z.enum(['user', 'assistant']).optional(),
});

const deleteUserCardSchema = z.string().uuid();

const fetchCardConversationsSchema = z.object({
  cardId: z.string().min(1),
  cardType: z.enum(['knowledge', 'user']),
});

const askCardQuestionSchema = z.object({
  cardId: z.string().min(1),
  cardType: z.enum(['knowledge', 'user']),
  question: z.string().min(1).max(2000),
  courseCode: z.string().min(1).optional(),
  courseId: z.string().uuid().optional(),
});

// ============================================================================
// KNOWLEDGE CARD ACTIONS
// ============================================================================

/**
 * Fetch knowledge cards related to a query via embedding similarity.
 */
export async function fetchRelatedCards(
  query: string,
  matchCount?: number,
): Promise<ActionResult<KnowledgeCardSummary[]>> {
  try {
    const parsed = fetchRelatedCardsSchema.safeParse({ query, matchCount });
    if (!parsed.success) {
      return { success: false, error: 'Invalid query.' };
    }

    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const service = getKnowledgeCardService();
    const cards = await service.findRelatedCards(parsed.data.query, parsed.data.matchCount);
    return { success: true, data: cards };
  } catch (error) {
    console.error('fetchRelatedCards error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch related cards';
    return { success: false, error: message };
  }
}

// ============================================================================
// USER CARD ACTIONS
// ============================================================================

/**
 * Fetch user-created cards, optionally filtered by session.
 */
export async function fetchUserCards(sessionId?: string): Promise<ActionResult<UserCardEntity[]>> {
  try {
    const parsed = fetchUserCardsSchema.safeParse({ sessionId });
    if (!parsed.success) {
      return { success: false, error: 'Invalid session ID.' };
    }

    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const service = getKnowledgeCardService();
    const cards = await service.getUserCards(user.id, parsed.data.sessionId);
    return { success: true, data: cards };
  } catch (error) {
    console.error('fetchUserCards error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch user cards';
    return { success: false, error: message };
  }
}

/**
 * Create a user card from text selection in chat.
 */
export async function createUserCard(data: {
  sessionId?: string;
  title: string;
  content?: string;
  excerpt?: string;
  sourceMessageId?: string;
  sourceRole?: 'user' | 'assistant';
}): Promise<ActionResult<UserCardEntity>> {
  try {
    const parsed = createUserCardSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: 'Invalid card data.' };
    }

    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const service = getKnowledgeCardService();
    const card = await service.createUserCard({
      userId: user.id,
      ...parsed.data,
    });
    return { success: true, data: card };
  } catch (error) {
    console.error('createUserCard error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create card';
    return { success: false, error: message };
  }
}

/**
 * Delete a user-created card.
 */
export async function deleteUserCard(cardId: string): Promise<ActionResult<void>> {
  try {
    const parsed = deleteUserCardSchema.safeParse(cardId);
    if (!parsed.success) {
      return { success: false, error: 'Invalid card ID.' };
    }

    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const service = getKnowledgeCardService();
    await service.deleteUserCard(parsed.data, user.id);
    return { success: true, data: undefined };
  } catch (error) {
    console.error('deleteUserCard error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete card';
    return { success: false, error: message };
  }
}

// ============================================================================
// CARD CONVERSATION ACTIONS
// ============================================================================

/**
 * Fetch conversation history for a card.
 */
export async function fetchCardConversations(
  cardId: string,
  cardType: 'knowledge' | 'user',
): Promise<ActionResult<CardConversationEntity[]>> {
  try {
    const parsed = fetchCardConversationsSchema.safeParse({ cardId, cardType });
    if (!parsed.success) {
      return { success: false, error: 'Invalid card parameters.' };
    }

    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const service = getKnowledgeCardService();
    const conversations = await service.getCardConversations(
      parsed.data.cardId,
      parsed.data.cardType,
    );
    return { success: true, data: conversations };
  } catch (error) {
    console.error('fetchCardConversations error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch conversations';
    return { success: false, error: message };
  }
}

/**
 * Ask a follow-up question about a card.
 * Saves the user question, generates an AI response, saves the response,
 * and returns the AI answer.
 */
export async function askCardQuestion(
  cardId: string,
  cardType: 'knowledge' | 'user',
  question: string,
  courseCode?: string,
  courseId?: string,
): Promise<ActionResult<string>> {
  try {
    const parsed = askCardQuestionSchema.safeParse({ cardId, cardType, question, courseCode, courseId });
    if (!parsed.success) {
      return { success: false, error: 'Invalid question parameters.' };
    }

    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    // Enforce AI quota before LLM call
    await getQuotaService().enforce(user.id);

    const cardService = getKnowledgeCardService();

    // Save the user's question
    await cardService.addCardConversation({
      cardId: parsed.data.cardId,
      cardType: parsed.data.cardType,
      userId: user.id,
      courseCode: parsed.data.courseCode,
      role: 'user',
      content: parsed.data.question,
    });

    // Generate AI response using ChatService.explainConcept
    const chatService = getChatService();
    const answer = await chatService.explainConcept(
      parsed.data.question,
      `Follow-up question about a ${parsed.data.cardType} card`,
      parsed.data.courseId,
    );

    // Save the assistant's answer
    await cardService.addCardConversation({
      cardId: parsed.data.cardId,
      cardType: parsed.data.cardType,
      userId: user.id,
      courseCode: parsed.data.courseCode,
      role: 'assistant',
      content: answer,
    });

    return { success: true, data: answer };
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return { success: false, error: error.message };
    }
    console.error('askCardQuestion error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate answer';
    return { success: false, error: message };
  }
}
