import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuotaExceededError } from '@/lib/errors';
import type { ChatMessage, ChatSession, Course, TutoringMode } from '@/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCurrentUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

const mockChatService = {
  generateResponse: vi.fn(),
  explainConcept: vi.fn(),
};
vi.mock('@/lib/services/ChatService', () => ({
  getChatService: () => mockChatService,
}));

const mockSessionService = {
  getFullSession: vi.fn(),
  getSessionMessages: vi.fn(),
  getUserSessions: vi.fn(),
  getSharedSession: vi.fn(),
  createSession: vi.fn(),
  saveMessage: vi.fn(),
  updateTitle: vi.fn(),
  updateMode: vi.fn(),
  togglePin: vi.fn(),
  toggleShare: vi.fn(),
  deleteSession: vi.fn(),
};
vi.mock('@/lib/services/SessionService', () => ({
  getSessionService: () => mockSessionService,
}));

const mockQuotaService = {
  enforce: vi.fn(),
};
vi.mock('@/lib/services/QuotaService', () => ({
  getQuotaService: () => mockQuotaService,
}));

const mockCourseService = {
  getCourseById: vi.fn(),
};
vi.mock('@/lib/services/CourseService', () => ({
  getCourseService: () => mockCourseService,
}));

// ---------------------------------------------------------------------------
// Import actions (after mocks are registered)
// ---------------------------------------------------------------------------

const {
  generateChatResponse,
  explainConcept,
  getChatSession,
  getChatMessages,
  getChatSessions,
  getSharedSession,
  createChatSession,
  saveChatMessage,
  updateChatSessionTitle,
  updateChatSessionMode,
  toggleSessionPin,
  toggleSessionShare,
  deleteChatSession,
} = await import('./chat');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COURSE_ID = '00000000-0000-0000-0000-000000000001';
const COURSE: Course = {
  id: COURSE_ID,
  universityId: 'uni-1',
  code: 'CS101',
  name: 'Intro to CS',
};

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

const VALID_HISTORY: ChatMessage[] = [
  { id: 'msg-1', role: 'user', content: 'Hello', timestamp: 1000 },
];

const VALID_MODE: TutoringMode = 'Lecture Helper';

function makeSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: 'sess-1',
    course: COURSE,
    mode: 'Lecture Helper',
    title: 'Test Session',
    messages: [],
    lastUpdated: Date.now(),
    isPinned: false,
    isShared: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Chat Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockQuotaService.enforce.mockResolvedValue(undefined);
    mockCourseService.getCourseById.mockResolvedValue(COURSE);
  });

  // =========================================================================
  // generateChatResponse
  // =========================================================================
  describe('generateChatResponse', () => {
    it('should return success with AI response for valid input', async () => {
      mockChatService.generateResponse.mockResolvedValue('Recursion is...');

      const result = await generateChatResponse(
        COURSE_ID,
        VALID_MODE,
        VALID_HISTORY,
        'Explain recursion',
      );

      expect(result).toEqual({ success: true, data: 'Recursion is...' });
      expect(mockChatService.generateResponse).toHaveBeenCalledWith({
        course: COURSE,
        mode: VALID_MODE,
        history: VALID_HISTORY,
        userInput: 'Explain recursion',
      });
    });

    it('should return error when mode is null', async () => {
      const result = await generateChatResponse(COURSE_ID, null, VALID_HISTORY, 'input');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Tutoring Mode must be selected');
      }
      expect(mockChatService.generateResponse).not.toHaveBeenCalled();
    });

    it('should return error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await generateChatResponse(COURSE_ID, VALID_MODE, VALID_HISTORY, 'input');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized');
      }
    });

    it('should return isLimitError when quota is exceeded', async () => {
      mockQuotaService.enforce.mockRejectedValue(new QuotaExceededError(10, 10));

      const result = await generateChatResponse(COURSE_ID, VALID_MODE, VALID_HISTORY, 'input');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.isLimitError).toBe(true);
      }
    });

    it('should return validation error for empty userInput', async () => {
      const result = await generateChatResponse(COURSE_ID, VALID_MODE, VALID_HISTORY, '');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Validation Failed');
      }
    });

    it('should return validation error for invalid courseId (not a UUID)', async () => {
      const result = await generateChatResponse('bad-id', VALID_MODE, VALID_HISTORY, 'input');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Validation Failed');
      }
    });

    it('should return validation error for invalid mode value', async () => {
      const result = await generateChatResponse(
        COURSE_ID,
        'Invalid Mode' as TutoringMode,
        VALID_HISTORY,
        'input',
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Tutoring Mode must be selected');
      }
    });

    it('should mask unexpected errors from the AI service', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockChatService.generateResponse.mockRejectedValue(new Error('Gemini API timeout'));

      const result = await generateChatResponse(COURSE_ID, VALID_MODE, VALID_HISTORY, 'input');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('unexpected error');
        expect(result.isLimitError).toBeUndefined();
      }
    });

    it('should check quota before calling chat service', async () => {
      mockQuotaService.enforce.mockRejectedValue(new QuotaExceededError(10, 10));

      await generateChatResponse(COURSE_ID, VALID_MODE, VALID_HISTORY, 'input');

      expect(mockQuotaService.enforce).toHaveBeenCalledWith('user-1');
      expect(mockChatService.generateResponse).not.toHaveBeenCalled();
    });

    it('should return error when course is not found', async () => {
      mockCourseService.getCourseById.mockResolvedValue(null);

      const result = await generateChatResponse(COURSE_ID, VALID_MODE, VALID_HISTORY, 'input');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid Course Context');
      }
    });
  });

  // =========================================================================
  // explainConcept
  // =========================================================================
  describe('explainConcept', () => {
    it('should return success with explanation', async () => {
      mockChatService.explainConcept.mockResolvedValue('A stack is...');

      const result = await explainConcept('Stack', 'Data structures lecture');

      expect(result).toEqual({ success: true, data: 'A stack is...' });
      expect(mockChatService.explainConcept).toHaveBeenCalledWith(
        'Stack',
        'Data structures lecture',
        undefined,
      );
    });

    it('should pass courseCode when provided', async () => {
      mockChatService.explainConcept.mockResolvedValue('Explanation');

      await explainConcept('Stack', 'context', 'CS101');

      expect(mockChatService.explainConcept).toHaveBeenCalledWith('Stack', 'context', 'CS101');
    });

    it('should return error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await explainConcept('Stack', 'context');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized');
      }
    });

    it('should return error when quota is exceeded', async () => {
      mockQuotaService.enforce.mockRejectedValue(new QuotaExceededError(10, 10));

      const result = await explainConcept('Stack', 'context');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('exceeded');
      }
    });

    it('should return validation error for empty concept', async () => {
      const result = await explainConcept('', 'context');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid');
      }
    });

    it('should return validation error for empty context', async () => {
      const result = await explainConcept('Stack', '');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid');
      }
    });

    it('should handle generic errors from chat service', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockChatService.explainConcept.mockRejectedValue(new Error('Service failure'));

      const result = await explainConcept('Stack', 'context');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Service failure');
      }
    });

    it('should return generic message for non-Error thrown objects', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockChatService.explainConcept.mockRejectedValue('string error');

      const result = await explainConcept('Stack', 'context');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Failed to explain concept');
      }
    });
  });

  // =========================================================================
  // getChatSession
  // =========================================================================
  describe('getChatSession', () => {
    it('should return session for valid sessionId and authenticated user', async () => {
      const session = makeSession();
      mockSessionService.getFullSession.mockResolvedValue(session);

      const result = await getChatSession('sess-1');

      expect(result).toEqual(session);
      expect(mockSessionService.getFullSession).toHaveBeenCalledWith('sess-1', 'user-1');
    });

    it('should return null when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getChatSession('sess-1');

      expect(result).toBeNull();
      expect(mockSessionService.getFullSession).not.toHaveBeenCalled();
    });

    it('should return null for empty sessionId (validation failure)', async () => {
      const result = await getChatSession('');

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // getChatMessages
  // =========================================================================
  describe('getChatMessages', () => {
    it('should return messages for a valid session', async () => {
      const messages: ChatMessage[] = [
        { id: 'msg-1', role: 'user', content: 'Hi', timestamp: 1000 },
      ];
      mockSessionService.getSessionMessages.mockResolvedValue(messages);

      const result = await getChatMessages('sess-1');

      expect(result).toEqual(messages);
      expect(mockSessionService.getSessionMessages).toHaveBeenCalledWith('sess-1', 'user-1');
    });

    it('should return null when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getChatMessages('sess-1');

      expect(result).toBeNull();
    });

    it('should return null for empty sessionId', async () => {
      const result = await getChatMessages('');

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // getChatSessions
  // =========================================================================
  describe('getChatSessions', () => {
    it('should return all user sessions', async () => {
      const sessions = [makeSession({ id: 'sess-1' }), makeSession({ id: 'sess-2' })];
      mockSessionService.getUserSessions.mockResolvedValue(sessions);

      const result = await getChatSessions();

      expect(result).toEqual(sessions);
      expect(mockSessionService.getUserSessions).toHaveBeenCalledWith('user-1');
    });

    it('should return empty array when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getChatSessions();

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // getSharedSession
  // =========================================================================
  describe('getSharedSession', () => {
    it('should return shared session without auth', async () => {
      const session = makeSession({ isShared: true });
      mockSessionService.getSharedSession.mockResolvedValue(session);

      // No auth needed - even works with null user
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getSharedSession('sess-1');

      expect(result).toEqual(session);
      expect(mockSessionService.getSharedSession).toHaveBeenCalledWith('sess-1');
    });

    it('should return null for empty sessionId', async () => {
      const result = await getSharedSession('');

      expect(result).toBeNull();
    });

    it('should return null when session is not found', async () => {
      mockSessionService.getSharedSession.mockResolvedValue(null);

      const result = await getSharedSession('nonexistent');

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // createChatSession
  // =========================================================================
  describe('createChatSession', () => {
    it('should create a new session for authenticated user', async () => {
      const created = makeSession();
      mockSessionService.createSession.mockResolvedValue(created);

      const input = {
        courseId: COURSE_ID,
        mode: 'Lecture Helper' as TutoringMode,
        title: 'New Session',
      };

      const result = await createChatSession(input);

      expect(result).toEqual(created);
      expect(mockSessionService.createSession).toHaveBeenCalledWith(
        'user-1',
        COURSE_ID,
        'Lecture Helper',
        'New Session',
      );
    });

    it('should throw when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const input = {
        courseId: COURSE_ID,
        mode: 'Lecture Helper' as TutoringMode,
        title: 'New Session',
      };

      await expect(createChatSession(input)).rejects.toThrow('Not authenticated');
    });

    it('should throw for invalid payload (empty title)', async () => {
      const input = {
        courseId: COURSE_ID,
        mode: 'Lecture Helper' as TutoringMode,
        title: '',
      };

      await expect(createChatSession(input)).rejects.toThrow('Validation Failed');
    });

    it('should accept null mode', async () => {
      const created = makeSession({ mode: null });
      mockSessionService.createSession.mockResolvedValue(created);

      const input = {
        courseId: COURSE_ID,
        mode: null,
        title: 'No Mode Session',
      };

      const result = await createChatSession(input);

      expect(result.mode).toBeNull();
      expect(mockSessionService.createSession).toHaveBeenCalledWith(
        'user-1',
        COURSE_ID,
        null,
        'No Mode Session',
      );
    });
  });

  // =========================================================================
  // saveChatMessage
  // =========================================================================
  describe('saveChatMessage', () => {
    const validMessage: ChatMessage = {
      id: 'msg-new',
      role: 'user',
      content: 'Hello AI',
      timestamp: Date.now(),
    };

    it('should save message for authenticated user', async () => {
      mockSessionService.saveMessage.mockResolvedValue(undefined);

      await saveChatMessage('sess-1', validMessage);

      expect(mockSessionService.saveMessage).toHaveBeenCalledWith('sess-1', 'user-1', validMessage);
    });

    it('should throw when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      await expect(saveChatMessage('sess-1', validMessage)).rejects.toThrow('Unauthorized');
    });

    it('should throw for invalid payload (empty sessionId)', async () => {
      await expect(saveChatMessage('', validMessage)).rejects.toThrow('Validation Failed');
    });

    it('should throw for invalid message (empty content)', async () => {
      const badMessage = { ...validMessage, content: '' };

      await expect(saveChatMessage('sess-1', badMessage)).rejects.toThrow('Validation Failed');
    });
  });

  // =========================================================================
  // updateChatSessionTitle
  // =========================================================================
  describe('updateChatSessionTitle', () => {
    it('should update title for authenticated user', async () => {
      mockSessionService.updateTitle.mockResolvedValue(undefined);

      await updateChatSessionTitle('sess-1', 'New Title');

      expect(mockSessionService.updateTitle).toHaveBeenCalledWith('sess-1', 'user-1', 'New Title');
    });

    it('should throw when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      await expect(updateChatSessionTitle('sess-1', 'Title')).rejects.toThrow('Unauthorized');
    });

    it('should throw for empty title', async () => {
      await expect(updateChatSessionTitle('sess-1', '')).rejects.toThrow('Validation Failed');
    });

    it('should throw for empty sessionId', async () => {
      await expect(updateChatSessionTitle('', 'Title')).rejects.toThrow('Validation Failed');
    });
  });

  // =========================================================================
  // updateChatSessionMode
  // =========================================================================
  describe('updateChatSessionMode', () => {
    it('should update mode for authenticated user', async () => {
      mockSessionService.updateMode.mockResolvedValue(undefined);

      await updateChatSessionMode('sess-1', 'Assignment Coach');

      expect(mockSessionService.updateMode).toHaveBeenCalledWith(
        'sess-1',
        'user-1',
        'Assignment Coach',
      );
    });

    it('should throw when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      await expect(updateChatSessionMode('sess-1', 'Lecture Helper')).rejects.toThrow(
        'Unauthorized',
      );
    });

    it('should throw for invalid mode', async () => {
      await expect(updateChatSessionMode('sess-1', 'Bad Mode' as TutoringMode)).rejects.toThrow(
        'Validation Failed',
      );
    });
  });

  // =========================================================================
  // toggleSessionPin
  // =========================================================================
  describe('toggleSessionPin', () => {
    it('should pin a session for authenticated user', async () => {
      mockSessionService.togglePin.mockResolvedValue(undefined);

      await toggleSessionPin('sess-1', true);

      expect(mockSessionService.togglePin).toHaveBeenCalledWith('sess-1', 'user-1', true);
    });

    it('should unpin a session for authenticated user', async () => {
      mockSessionService.togglePin.mockResolvedValue(undefined);

      await toggleSessionPin('sess-1', false);

      expect(mockSessionService.togglePin).toHaveBeenCalledWith('sess-1', 'user-1', false);
    });

    it('should throw when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      await expect(toggleSessionPin('sess-1', true)).rejects.toThrow('Unauthorized');
    });

    it('should throw for empty sessionId', async () => {
      await expect(toggleSessionPin('', true)).rejects.toThrow('Validation Failed');
    });
  });

  // =========================================================================
  // toggleSessionShare
  // =========================================================================
  describe('toggleSessionShare', () => {
    it('should share a session for authenticated user', async () => {
      mockSessionService.toggleShare.mockResolvedValue(undefined);

      await toggleSessionShare('sess-1', true);

      expect(mockSessionService.toggleShare).toHaveBeenCalledWith('sess-1', 'user-1', true);
    });

    it('should unshare a session for authenticated user', async () => {
      mockSessionService.toggleShare.mockResolvedValue(undefined);

      await toggleSessionShare('sess-1', false);

      expect(mockSessionService.toggleShare).toHaveBeenCalledWith('sess-1', 'user-1', false);
    });

    it('should throw when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      await expect(toggleSessionShare('sess-1', true)).rejects.toThrow('Unauthorized');
    });

    it('should throw for empty sessionId', async () => {
      await expect(toggleSessionShare('', true)).rejects.toThrow('Validation Failed');
    });
  });

  // =========================================================================
  // deleteChatSession
  // =========================================================================
  describe('deleteChatSession', () => {
    it('should delete session for authenticated user', async () => {
      mockSessionService.deleteSession.mockResolvedValue(undefined);

      await deleteChatSession('sess-1');

      expect(mockSessionService.deleteSession).toHaveBeenCalledWith('sess-1', 'user-1');
    });

    it('should throw when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      await expect(deleteChatSession('sess-1')).rejects.toThrow('Unauthorized');
    });

    it('should throw for empty sessionId', async () => {
      await expect(deleteChatSession('')).rejects.toThrow('Validation Failed');
    });
  });
});
