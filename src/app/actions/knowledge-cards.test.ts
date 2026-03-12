import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuotaExceededError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCurrentUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

const mockKnowledgeCardService = {
  findRelatedCards: vi.fn(),
  updateCard: vi.fn(),
  getUserCards: vi.fn(),
  createUserCard: vi.fn(),
  deleteUserCard: vi.fn(),
  getCardConversations: vi.fn(),
  addCardConversation: vi.fn(),
};
vi.mock('@/lib/services/KnowledgeCardService', () => ({
  getKnowledgeCardService: () => mockKnowledgeCardService,
}));

const mockChatService = {
  explainConcept: vi.fn(),
};
vi.mock('@/lib/services/ChatService', () => ({
  getChatService: () => mockChatService,
}));

const mockQuotaService = {
  enforce: vi.fn(),
};
vi.mock('@/lib/services/QuotaService', () => ({
  getQuotaService: () => mockQuotaService,
}));

// ---------------------------------------------------------------------------
// Import actions (after mocks)
// ---------------------------------------------------------------------------

const {
  fetchRelatedCards,
  updateKnowledgeCard,
  fetchUserCards,
  createUserCard,
  deleteUserCard,
  fetchCardConversations,
  askCardQuestion,
} = await import('./knowledge-cards');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'aaaaaaaa-bbbb-1ccc-8ddd-eeeeeeeeeeee', email: 'user@test.com' };
const CARD_ID = '11111111-2222-3333-8444-555555555555';
const COURSE_ID = '22222222-3333-4444-8555-666666666666';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Knowledge Card Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockQuotaService.enforce.mockResolvedValue(undefined);
  });

  // =========================================================================
  // fetchRelatedCards
  // =========================================================================
  describe('fetchRelatedCards', () => {
    it('should return related cards for a valid query', async () => {
      const mockCards = [{ id: 'card-1', title: 'Derivatives' }];
      mockKnowledgeCardService.findRelatedCards.mockResolvedValue(mockCards);

      const result = await fetchRelatedCards('calculus derivatives');

      expect(result).toEqual({ success: true, data: mockCards });
      expect(mockKnowledgeCardService.findRelatedCards).toHaveBeenCalledWith(
        'calculus derivatives',
        undefined,
      );
    });

    it('should pass matchCount when provided', async () => {
      mockKnowledgeCardService.findRelatedCards.mockResolvedValue([]);

      await fetchRelatedCards('query', 5);

      expect(mockKnowledgeCardService.findRelatedCards).toHaveBeenCalledWith('query', 5);
    });

    it('should return error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await fetchRelatedCards('query');

      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('should return error for empty query', async () => {
      const result = await fetchRelatedCards('');

      expect(result).toEqual({ success: false, error: 'Invalid query.' });
      expect(mockKnowledgeCardService.findRelatedCards).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockKnowledgeCardService.findRelatedCards.mockRejectedValue(new Error('Embedding failed'));

      const result = await fetchRelatedCards('query');

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error', 'Embedding failed');
    });
  });

  // =========================================================================
  // updateKnowledgeCard
  // =========================================================================
  describe('updateKnowledgeCard', () => {
    it('should update a card successfully', async () => {
      mockKnowledgeCardService.updateCard.mockResolvedValue({ id: CARD_ID });

      const result = await updateKnowledgeCard({
        cardId: CARD_ID,
        title: 'Updated Title',
        definition: 'New definition',
      });

      expect(result).toEqual({ success: true, data: { id: CARD_ID } });
      expect(mockKnowledgeCardService.updateCard).toHaveBeenCalledWith(CARD_ID, {
        title: 'Updated Title',
        definition: 'New definition',
      });
    });

    it('should return error when not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await updateKnowledgeCard({ cardId: CARD_ID, title: 'Title' });

      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('should return error for invalid card ID', async () => {
      const result = await updateKnowledgeCard({ cardId: 'not-uuid', title: 'Title' });

      expect(result).toEqual({ success: false, error: 'Invalid card data.' });
    });

    it('should handle service errors', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockKnowledgeCardService.updateCard.mockRejectedValue(new Error('Not found'));

      const result = await updateKnowledgeCard({ cardId: CARD_ID, title: 'Title' });

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error', 'Not found');
    });
  });

  // =========================================================================
  // fetchUserCards
  // =========================================================================
  describe('fetchUserCards', () => {
    it('should return user cards', async () => {
      const mockCards = [{ id: 'uc-1', title: 'My Note' }];
      mockKnowledgeCardService.getUserCards.mockResolvedValue(mockCards);

      const result = await fetchUserCards();

      expect(result).toEqual({ success: true, data: mockCards });
      expect(mockKnowledgeCardService.getUserCards).toHaveBeenCalledWith(MOCK_USER.id, undefined);
    });

    it('should pass sessionId when provided', async () => {
      mockKnowledgeCardService.getUserCards.mockResolvedValue([]);

      await fetchUserCards('session-123');

      expect(mockKnowledgeCardService.getUserCards).toHaveBeenCalledWith(
        MOCK_USER.id,
        'session-123',
      );
    });

    it('should return error when not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await fetchUserCards();

      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('should handle service errors', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockKnowledgeCardService.getUserCards.mockRejectedValue(new Error('DB error'));

      const result = await fetchUserCards();

      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // createUserCard
  // =========================================================================
  describe('createUserCard', () => {
    const validInput = {
      title: 'My Card',
      content: 'Some content',
      excerpt: 'excerpt',
    };

    it('should create a user card', async () => {
      const mockCard = { id: 'uc-new', ...validInput, userId: MOCK_USER.id };
      mockKnowledgeCardService.createUserCard.mockResolvedValue(mockCard);

      const result = await createUserCard(validInput);

      expect(result).toEqual({ success: true, data: mockCard });
      expect(mockKnowledgeCardService.createUserCard).toHaveBeenCalledWith({
        userId: MOCK_USER.id,
        ...validInput,
      });
    });

    it('should return error when not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await createUserCard(validInput);

      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('should return error for invalid data (empty title)', async () => {
      const result = await createUserCard({ title: '' });

      expect(result).toEqual({ success: false, error: 'Invalid card data.' });
    });

    it('should handle service errors', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockKnowledgeCardService.createUserCard.mockRejectedValue(new Error('Failed'));

      const result = await createUserCard(validInput);

      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // deleteUserCard
  // =========================================================================
  describe('deleteUserCard', () => {
    it('should delete a user card', async () => {
      mockKnowledgeCardService.deleteUserCard.mockResolvedValue(undefined);

      const result = await deleteUserCard(CARD_ID);

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockKnowledgeCardService.deleteUserCard).toHaveBeenCalledWith(CARD_ID, MOCK_USER.id);
    });

    it('should return error when not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await deleteUserCard(CARD_ID);

      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('should return error for invalid card ID', async () => {
      const result = await deleteUserCard('not-uuid');

      expect(result).toEqual({ success: false, error: 'Invalid card ID.' });
    });

    it('should handle service errors', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockKnowledgeCardService.deleteUserCard.mockRejectedValue(new Error('Failed'));

      const result = await deleteUserCard(CARD_ID);

      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // fetchCardConversations
  // =========================================================================
  describe('fetchCardConversations', () => {
    it('should fetch conversations for a knowledge card', async () => {
      const mockConvos = [{ id: 'conv-1', role: 'user', content: 'Hello' }];
      mockKnowledgeCardService.getCardConversations.mockResolvedValue(mockConvos);

      const result = await fetchCardConversations(CARD_ID, 'knowledge');

      expect(result).toEqual({ success: true, data: mockConvos });
      expect(mockKnowledgeCardService.getCardConversations).toHaveBeenCalledWith(
        CARD_ID,
        'knowledge',
      );
    });

    it('should fetch conversations for a user card', async () => {
      mockKnowledgeCardService.getCardConversations.mockResolvedValue([]);

      const result = await fetchCardConversations(CARD_ID, 'user');

      expect(result).toEqual({ success: true, data: [] });
      expect(mockKnowledgeCardService.getCardConversations).toHaveBeenCalledWith(CARD_ID, 'user');
    });

    it('should return error when not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await fetchCardConversations(CARD_ID, 'knowledge');

      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('should return error for invalid card type', async () => {
      const result = await fetchCardConversations(CARD_ID, 'invalid' as 'knowledge');

      expect(result).toEqual({ success: false, error: 'Invalid card parameters.' });
    });

    it('should handle service errors', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockKnowledgeCardService.getCardConversations.mockRejectedValue(new Error('Failed'));

      const result = await fetchCardConversations(CARD_ID, 'knowledge');

      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // askCardQuestion
  // =========================================================================
  describe('askCardQuestion', () => {
    it('should ask a question and return AI answer', async () => {
      mockChatService.explainConcept.mockResolvedValue('The derivative of x^2 is 2x.');

      const result = await askCardQuestion(CARD_ID, 'knowledge', 'What is a derivative?');

      expect(result).toEqual({ success: true, data: 'The derivative of x^2 is 2x.' });

      // Verify user question was saved
      expect(mockKnowledgeCardService.addCardConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: CARD_ID,
          cardType: 'knowledge',
          userId: MOCK_USER.id,
          role: 'user',
          content: 'What is a derivative?',
        }),
      );

      // Verify AI response was saved
      expect(mockKnowledgeCardService.addCardConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: CARD_ID,
          cardType: 'knowledge',
          userId: MOCK_USER.id,
          role: 'assistant',
          content: 'The derivative of x^2 is 2x.',
        }),
      );

      // Verify quota was enforced
      expect(mockQuotaService.enforce).toHaveBeenCalledWith(MOCK_USER.id);
    });

    it('should pass courseCode and courseId', async () => {
      mockChatService.explainConcept.mockResolvedValue('Answer');

      await askCardQuestion(CARD_ID, 'knowledge', 'Question?', 'CS101', COURSE_ID);

      expect(mockChatService.explainConcept).toHaveBeenCalledWith(
        'Question?',
        'Follow-up question about a knowledge card',
        COURSE_ID,
      );

      expect(mockKnowledgeCardService.addCardConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          courseCode: 'CS101',
        }),
      );
    });

    it('should return error when not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await askCardQuestion(CARD_ID, 'knowledge', 'Question?');

      expect(result).toEqual({ success: false, error: 'Unauthorized' });
      expect(mockQuotaService.enforce).not.toHaveBeenCalled();
    });

    it('should return QUOTA_EXCEEDED when quota is exceeded', async () => {
      mockQuotaService.enforce.mockRejectedValue(new QuotaExceededError(10, 10));

      const result = await askCardQuestion(CARD_ID, 'knowledge', 'Question?');

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', 'QUOTA_EXCEEDED');
      expect(mockChatService.explainConcept).not.toHaveBeenCalled();
    });

    it('should return error for empty question', async () => {
      const result = await askCardQuestion(CARD_ID, 'knowledge', '');

      expect(result).toEqual({ success: false, error: 'Invalid question parameters.' });
    });

    it('should return error for invalid card type', async () => {
      const result = await askCardQuestion(CARD_ID, 'bad' as 'knowledge', 'Question?');

      expect(result).toEqual({ success: false, error: 'Invalid question parameters.' });
    });

    it('should handle chat service errors', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockChatService.explainConcept.mockRejectedValue(new Error('LLM timeout'));

      const result = await askCardQuestion(CARD_ID, 'knowledge', 'Question?');

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error', 'LLM timeout');
    });
  });
});
