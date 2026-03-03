import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage, ChatSession, Course, TutoringMode } from '@/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCurrentUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
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
  editAndRegenerate: vi.fn(),
  switchBranch: vi.fn(),
};
vi.mock('@/lib/services/SessionService', () => ({
  getSessionService: () => mockSessionService,
}));

vi.mock('@/lib/errors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/errors')>();
  return { ...actual };
});

// ---------------------------------------------------------------------------
// Import actions (after mocks are registered)
// ---------------------------------------------------------------------------

const {
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
  editAndRegenerate,
  switchBranch,
} = await import('./chat');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COURSE_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const SESSION_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
const SESSION_ID_2 = 'c1ffcd00-ad1c-4ef9-bb7e-7cc0ce491b33';
const NONEXISTENT_SESSION_ID = 'd2aabc11-1e2f-4ab0-8c3d-1234567890ab';
const COURSE: Course = {
  id: COURSE_ID,
  universityId: 'uni-1',
  code: 'CS101',
  name: 'Intro to CS',
};

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

function makeSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: SESSION_ID,
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
  });

  // =========================================================================
  // getChatSession
  // =========================================================================
  describe('getChatSession', () => {
    it('should return session for valid sessionId and authenticated user', async () => {
      const session = makeSession();
      mockSessionService.getFullSession.mockResolvedValue(session);

      const result = await getChatSession(SESSION_ID);

      expect(result).toEqual({ success: true, data: session });
      expect(mockSessionService.getFullSession).toHaveBeenCalledWith(SESSION_ID, 'user-1');
    });

    it('should return error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getChatSession(SESSION_ID);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('UNAUTHORIZED');
      expect(mockSessionService.getFullSession).not.toHaveBeenCalled();
    });

    it('should return error for empty sessionId (validation failure)', async () => {
      const result = await getChatSession('');

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('VALIDATION');
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

      const result = await getChatMessages(SESSION_ID);

      expect(result).toEqual({ success: true, data: messages });
      expect(mockSessionService.getSessionMessages).toHaveBeenCalledWith(SESSION_ID, 'user-1');
    });

    it('should return error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getChatMessages(SESSION_ID);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('UNAUTHORIZED');
    });

    it('should return error for empty sessionId', async () => {
      const result = await getChatMessages('');

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('VALIDATION');
    });
  });

  // =========================================================================
  // getChatSessions
  // =========================================================================
  describe('getChatSessions', () => {
    it('should return all user sessions', async () => {
      const sessions = [makeSession({ id: SESSION_ID }), makeSession({ id: SESSION_ID_2 })];
      mockSessionService.getUserSessions.mockResolvedValue(sessions);

      const result = await getChatSessions();

      expect(result).toEqual({ success: true, data: sessions });
      expect(mockSessionService.getUserSessions).toHaveBeenCalledWith('user-1');
    });

    it('should return error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getChatSessions();

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('UNAUTHORIZED');
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

      const result = await getSharedSession(SESSION_ID);

      expect(result).toEqual({ success: true, data: session });
      expect(mockSessionService.getSharedSession).toHaveBeenCalledWith(SESSION_ID);
    });

    it('should return error for empty sessionId', async () => {
      const result = await getSharedSession('');

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('VALIDATION');
    });

    it('should return null data when session is not found', async () => {
      mockSessionService.getSharedSession.mockResolvedValue(null);

      const result = await getSharedSession(NONEXISTENT_SESSION_ID);

      expect(result).toEqual({ success: true, data: null });
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

      expect(result).toEqual({ success: true, data: created });
      expect(mockSessionService.createSession).toHaveBeenCalledWith(
        'user-1',
        COURSE_ID,
        'Lecture Helper',
        'New Session',
      );
    });

    it('should return error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const input = {
        courseId: COURSE_ID,
        mode: 'Lecture Helper' as TutoringMode,
        title: 'New Session',
      };

      const result = await createChatSession(input);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('UNAUTHORIZED');
    });

    it('should return error for invalid payload (empty title)', async () => {
      const input = {
        courseId: COURSE_ID,
        mode: 'Lecture Helper' as TutoringMode,
        title: '',
      };

      const result = await createChatSession(input);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('VALIDATION');
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

      expect(result.success).toBe(true);
      if (result.success) expect(result.data.mode).toBeNull();
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

      const result = await saveChatMessage(SESSION_ID, validMessage);

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockSessionService.saveMessage).toHaveBeenCalledWith(
        SESSION_ID,
        'user-1',
        validMessage,
      );
    });

    it('should return error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await saveChatMessage(SESSION_ID, validMessage);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('UNAUTHORIZED');
    });

    it('should return error for invalid payload (empty sessionId)', async () => {
      const result = await saveChatMessage('', validMessage);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('VALIDATION');
    });

    it('should return error for invalid message (empty content)', async () => {
      const badMessage = { ...validMessage, content: '' };

      const result = await saveChatMessage(SESSION_ID, badMessage);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('VALIDATION');
    });
  });

  // =========================================================================
  // updateChatSessionTitle
  // =========================================================================
  describe('updateChatSessionTitle', () => {
    it('should update title for authenticated user', async () => {
      mockSessionService.updateTitle.mockResolvedValue(undefined);

      const result = await updateChatSessionTitle(SESSION_ID, 'New Title');

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockSessionService.updateTitle).toHaveBeenCalledWith(
        SESSION_ID,
        'user-1',
        'New Title',
      );
    });

    it('should return error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await updateChatSessionTitle(SESSION_ID, 'Title');

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('UNAUTHORIZED');
    });

    it('should return error for empty title', async () => {
      const result = await updateChatSessionTitle(SESSION_ID, '');

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('VALIDATION');
    });

    it('should return error for empty sessionId', async () => {
      const result = await updateChatSessionTitle('', 'Title');

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('VALIDATION');
    });
  });

  // =========================================================================
  // updateChatSessionMode
  // =========================================================================
  describe('updateChatSessionMode', () => {
    it('should update mode for authenticated user', async () => {
      mockSessionService.updateMode.mockResolvedValue(undefined);

      const result = await updateChatSessionMode(SESSION_ID, 'Assignment Coach');

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockSessionService.updateMode).toHaveBeenCalledWith(
        SESSION_ID,
        'user-1',
        'Assignment Coach',
      );
    });

    it('should return error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await updateChatSessionMode(SESSION_ID, 'Lecture Helper');

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('UNAUTHORIZED');
    });

    it('should return error for invalid mode', async () => {
      const result = await updateChatSessionMode(SESSION_ID, 'Bad Mode' as TutoringMode);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('VALIDATION');
    });
  });

  // =========================================================================
  // toggleSessionPin
  // =========================================================================
  describe('toggleSessionPin', () => {
    it('should pin a session for authenticated user', async () => {
      mockSessionService.togglePin.mockResolvedValue(undefined);

      const result = await toggleSessionPin(SESSION_ID, true);

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockSessionService.togglePin).toHaveBeenCalledWith(SESSION_ID, 'user-1', true);
    });

    it('should unpin a session for authenticated user', async () => {
      mockSessionService.togglePin.mockResolvedValue(undefined);

      const result = await toggleSessionPin(SESSION_ID, false);

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockSessionService.togglePin).toHaveBeenCalledWith(SESSION_ID, 'user-1', false);
    });

    it('should return error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await toggleSessionPin(SESSION_ID, true);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('UNAUTHORIZED');
    });

    it('should return error for empty sessionId', async () => {
      const result = await toggleSessionPin('', true);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('VALIDATION');
    });
  });

  // =========================================================================
  // toggleSessionShare
  // =========================================================================
  describe('toggleSessionShare', () => {
    it('should share a session for authenticated user', async () => {
      mockSessionService.toggleShare.mockResolvedValue(undefined);

      const result = await toggleSessionShare(SESSION_ID, true);

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockSessionService.toggleShare).toHaveBeenCalledWith(SESSION_ID, 'user-1', true);
    });

    it('should unshare a session for authenticated user', async () => {
      mockSessionService.toggleShare.mockResolvedValue(undefined);

      const result = await toggleSessionShare(SESSION_ID, false);

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockSessionService.toggleShare).toHaveBeenCalledWith(SESSION_ID, 'user-1', false);
    });

    it('should return error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await toggleSessionShare(SESSION_ID, true);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('UNAUTHORIZED');
    });

    it('should return error for empty sessionId', async () => {
      const result = await toggleSessionShare('', true);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('VALIDATION');
    });
  });

  // =========================================================================
  // deleteChatSession
  // =========================================================================
  describe('deleteChatSession', () => {
    it('should delete session for authenticated user', async () => {
      mockSessionService.deleteSession.mockResolvedValue(undefined);

      const result = await deleteChatSession(SESSION_ID);

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockSessionService.deleteSession).toHaveBeenCalledWith(SESSION_ID, 'user-1');
    });

    it('should return error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await deleteChatSession(SESSION_ID);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('UNAUTHORIZED');
    });

    it('should return error for empty sessionId', async () => {
      const result = await deleteChatSession('');

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('VALIDATION');
    });
  });

  // =========================================================================
  // editAndRegenerate
  // =========================================================================
  describe('editAndRegenerate', () => {
    it('should return error for unauthenticated user', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await editAndRegenerate(SESSION_ID, 'msg-1', 'new content');

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('UNAUTHORIZED');
    });

    it('should return error for invalid sessionId', async () => {
      const result = await editAndRegenerate('', 'msg-1', 'new content');

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('VALIDATION');
    });

    it('should return error for empty newContent', async () => {
      const result = await editAndRegenerate(SESSION_ID, 'msg-1', '');

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('VALIDATION');
    });

    it('should delegate to sessionService.editAndRegenerate', async () => {
      const mockResult = { newMessageId: 'msg-new', messages: [] as ChatMessage[], siblingsMap: {} };
      mockSessionService.editAndRegenerate.mockResolvedValue(mockResult);

      const result = await editAndRegenerate(SESSION_ID, 'msg-1', 'new content');

      expect(result).toEqual({ success: true, data: mockResult });
      expect(mockSessionService.editAndRegenerate).toHaveBeenCalledWith(
        SESSION_ID,
        'user-1',
        'msg-1',
        'new content',
      );
    });
  });

  // =========================================================================
  // switchBranch
  // =========================================================================
  describe('switchBranch', () => {
    it('should return error for unauthenticated user', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await switchBranch(SESSION_ID, 'parent-1', 'child-1');
      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('UNAUTHORIZED');
    });

    it('should return error for invalid sessionId', async () => {
      const result = await switchBranch('', 'parent-1', 'child-1');
      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('VALIDATION');
    });

    it('should delegate to sessionService.switchBranch', async () => {
      const msgs: ChatMessage[] = [];
      mockSessionService.switchBranch.mockResolvedValue(msgs);

      const result = await switchBranch(SESSION_ID, 'parent-1', 'child-1');

      expect(result).toEqual({ success: true, data: msgs });
      expect(mockSessionService.switchBranch).toHaveBeenCalledWith(
        SESSION_ID,
        'user-1',
        'parent-1',
        'child-1',
      );
    });
  });
});
