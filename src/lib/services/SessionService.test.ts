import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageEntity } from '@/lib/domain/models/Message';
import type { SessionEntity } from '@/lib/domain/models/Session';
import { ForbiddenError } from '@/lib/errors';
import type { MessageRepository } from '@/lib/repositories/MessageRepository';
import type { SessionRepository } from '@/lib/repositories/SessionRepository';
import type { Course, TutoringMode } from '@/types';

// Mock CourseService used internally by SessionService
const mockCourseService = {
  getCourseById: vi.fn(),
  getAllCourses: vi.fn(),
};
vi.mock('@/lib/services/CourseService', () => ({
  getCourseService: () => mockCourseService,
}));

// Import after mocks
const { SessionService } = await import('./SessionService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COURSE_ID = 'course-1';
const COURSE: Course = {
  id: COURSE_ID,
  universityId: 'uni-1',
  code: 'CS101',
  name: 'Intro to CS',
};

const now = new Date('2025-01-15T12:00:00Z');

function makeSessionEntity(overrides: Partial<SessionEntity> = {}): SessionEntity {
  return {
    id: 'sess-1',
    userId: 'user-1',
    courseId: COURSE_ID,
    mode: 'Lecture Helper',
    title: 'Test Session',
    isPinned: false,
    isShared: false,
    shareExpiresAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeMessageEntity(overrides: Partial<MessageEntity> = {}): MessageEntity {
  return {
    id: 'msg-1',
    sessionId: 'sess-1',
    role: 'user',
    content: 'Hello',
    createdAt: now,
    ...overrides,
  };
}

function createMockSessionRepo(): Record<keyof SessionRepository, ReturnType<typeof vi.fn>> {
  return {
    findByIdAndUserId: vi.fn(),
    findAllByUserId: vi.fn(),
    findSharedById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    verifyOwnership: vi.fn(),
  };
}

function createMockMessageRepo(): Record<keyof MessageRepository, ReturnType<typeof vi.fn>> {
  return {
    findBySessionId: vi.fn(),
    create: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SessionService', () => {
  let sessionRepo: ReturnType<typeof createMockSessionRepo>;
  let messageRepo: ReturnType<typeof createMockMessageRepo>;
  let service: InstanceType<typeof SessionService>;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionRepo = createMockSessionRepo();
    messageRepo = createMockMessageRepo();
    service = new SessionService(
      sessionRepo as unknown as SessionRepository,
      messageRepo as unknown as MessageRepository,
    );
    // Default: resolve courseId to the COURSE fixture
    mockCourseService.getCourseById.mockResolvedValue(COURSE);
    mockCourseService.getAllCourses.mockResolvedValue([COURSE]);
  });

  // =========================================================================
  // getFullSession
  // =========================================================================
  describe('getFullSession', () => {
    it('should return null when session is not found', async () => {
      sessionRepo.findByIdAndUserId.mockResolvedValue(null);

      const result = await service.getFullSession('sess-1', 'user-1');

      expect(result).toBeNull();
      expect(sessionRepo.findByIdAndUserId).toHaveBeenCalledWith('sess-1', 'user-1');
      expect(messageRepo.findBySessionId).not.toHaveBeenCalled();
    });

    it('should return full session with messages', async () => {
      const session = makeSessionEntity();
      const messages = [
        makeMessageEntity({ id: 'msg-1', content: 'Hello', role: 'user' }),
        makeMessageEntity({ id: 'msg-2', content: 'Hi there!', role: 'assistant' }),
      ];

      sessionRepo.findByIdAndUserId.mockResolvedValue(session);
      messageRepo.findBySessionId.mockResolvedValue(messages);

      const result = await service.getFullSession('sess-1', 'user-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('sess-1');
      expect(result!.course).toEqual(COURSE);
      expect(result!.mode).toBe('Lecture Helper');
      expect(result!.title).toBe('Test Session');
      expect(result!.messages).toHaveLength(2);
      expect(result!.messages[0].id).toBe('msg-1');
      expect(result!.messages[0].role).toBe('user');
      expect(result!.messages[0].content).toBe('Hello');
      expect(result!.messages[0].timestamp).toBe(now.getTime());
      expect(result!.lastUpdated).toBe(now.getTime());
      expect(result!.isPinned).toBe(false);
      expect(result!.isShared).toBe(false);
    });
  });

  // =========================================================================
  // getSessionMessages
  // =========================================================================
  describe('getSessionMessages', () => {
    it('should return null when ownership verification fails', async () => {
      sessionRepo.verifyOwnership.mockResolvedValue(false);

      const result = await service.getSessionMessages('sess-1', 'user-bad');

      expect(result).toBeNull();
      expect(messageRepo.findBySessionId).not.toHaveBeenCalled();
    });

    it('should return mapped messages when user owns the session', async () => {
      sessionRepo.verifyOwnership.mockResolvedValue(true);
      const messages = [
        makeMessageEntity({ id: 'msg-1', content: 'Q1', role: 'user' }),
        makeMessageEntity({ id: 'msg-2', content: 'A1', role: 'assistant' }),
      ];
      messageRepo.findBySessionId.mockResolvedValue(messages);

      const result = await service.getSessionMessages('sess-1', 'user-1');

      expect(result).toHaveLength(2);
      expect(result![0]).toEqual({
        id: 'msg-1',
        role: 'user',
        content: 'Q1',
        timestamp: now.getTime(),
      });
    });
  });

  // =========================================================================
  // getUserSessions
  // =========================================================================
  describe('getUserSessions', () => {
    it('should return all sessions with empty messages array', async () => {
      const sessions = [
        makeSessionEntity({ id: 'sess-1' }),
        makeSessionEntity({ id: 'sess-2', isPinned: true }),
      ];
      sessionRepo.findAllByUserId.mockResolvedValue(sessions);

      const result = await service.getUserSessions('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('sess-1');
      expect(result[0].messages).toEqual([]);
      expect(result[1].isPinned).toBe(true);
      expect(sessionRepo.findAllByUserId).toHaveBeenCalledWith('user-1');
    });

    it('should return empty array when no sessions exist', async () => {
      sessionRepo.findAllByUserId.mockResolvedValue([]);

      const result = await service.getUserSessions('user-new');

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // getSharedSession
  // =========================================================================
  describe('getSharedSession', () => {
    it('should return null when shared session is not found', async () => {
      sessionRepo.findSharedById.mockResolvedValue(null);

      const result = await service.getSharedSession('sess-99');

      expect(result).toBeNull();
      expect(messageRepo.findBySessionId).not.toHaveBeenCalled();
    });

    it('should return shared session with messages', async () => {
      const session = makeSessionEntity({ isShared: true });
      const messages = [makeMessageEntity()];

      sessionRepo.findSharedById.mockResolvedValue(session);
      messageRepo.findBySessionId.mockResolvedValue(messages);

      const result = await service.getSharedSession('sess-1');

      expect(result).not.toBeNull();
      expect(result!.isShared).toBe(true);
      expect(result!.messages).toHaveLength(1);
    });
  });

  // =========================================================================
  // createSession
  // =========================================================================
  describe('createSession', () => {
    it('should create and return a new session', async () => {
      const created = makeSessionEntity();
      sessionRepo.create.mockResolvedValue(created);

      const result = await service.createSession(
        'user-1',
        COURSE_ID,
        'Lecture Helper' as TutoringMode,
        'New Session',
      );

      expect(sessionRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        courseId: COURSE_ID,
        mode: 'Lecture Helper',
        title: 'New Session',
      });
      expect(result.id).toBe('sess-1');
      expect(result.messages).toEqual([]);
      expect(result.lastUpdated).toBe(now.getTime());
    });

    it('should accept null mode', async () => {
      const created = makeSessionEntity({ mode: null });
      sessionRepo.create.mockResolvedValue(created);

      const result = await service.createSession('user-1', COURSE_ID, null, 'No Mode Session');

      expect(sessionRepo.create).toHaveBeenCalledWith(expect.objectContaining({ mode: null }));
      expect(result.mode).toBeNull();
    });
  });

  // =========================================================================
  // saveMessage
  // =========================================================================
  describe('saveMessage', () => {
    it('should save message when user owns the session', async () => {
      sessionRepo.verifyOwnership.mockResolvedValue(true);
      messageRepo.create.mockResolvedValue(makeMessageEntity());

      const message = {
        id: 'msg-new',
        role: 'user' as const,
        content: 'Hello AI',
        timestamp: Date.now(),
      };

      await service.saveMessage('sess-1', 'user-1', message);

      expect(sessionRepo.verifyOwnership).toHaveBeenCalledWith('sess-1', 'user-1');
      expect(messageRepo.create).toHaveBeenCalledWith({
        sessionId: 'sess-1',
        role: 'user',
        content: 'Hello AI',
        timestamp: message.timestamp,
      });
    });

    it('should throw ForbiddenError when user does not own the session', async () => {
      sessionRepo.verifyOwnership.mockResolvedValue(false);

      const message = {
        id: 'msg-new',
        role: 'user' as const,
        content: 'Unauthorized',
        timestamp: Date.now(),
      };

      await expect(service.saveMessage('sess-1', 'user-bad', message)).rejects.toThrow(
        ForbiddenError,
      );
      expect(messageRepo.create).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // updateTitle
  // =========================================================================
  describe('updateTitle', () => {
    it('should update title when user owns the session', async () => {
      sessionRepo.verifyOwnership.mockResolvedValue(true);
      sessionRepo.update.mockResolvedValue(undefined);

      await service.updateTitle('sess-1', 'user-1', 'New Title');

      expect(sessionRepo.update).toHaveBeenCalledWith('sess-1', { title: 'New Title' });
    });

    it('should throw ForbiddenError when user does not own the session', async () => {
      sessionRepo.verifyOwnership.mockResolvedValue(false);

      await expect(service.updateTitle('sess-1', 'user-bad', 'Title')).rejects.toThrow(
        ForbiddenError,
      );
      expect(sessionRepo.update).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // updateMode
  // =========================================================================
  describe('updateMode', () => {
    it('should update mode when user owns the session', async () => {
      sessionRepo.verifyOwnership.mockResolvedValue(true);
      sessionRepo.update.mockResolvedValue(undefined);

      await service.updateMode('sess-1', 'user-1', 'Assignment Coach' as TutoringMode);

      expect(sessionRepo.update).toHaveBeenCalledWith('sess-1', { mode: 'Assignment Coach' });
    });

    it('should throw ForbiddenError for non-owner', async () => {
      sessionRepo.verifyOwnership.mockResolvedValue(false);

      await expect(
        service.updateMode('sess-1', 'user-bad', 'Assignment Coach' as TutoringMode),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // =========================================================================
  // togglePin
  // =========================================================================
  describe('togglePin', () => {
    it('should set isPinned to true', async () => {
      sessionRepo.verifyOwnership.mockResolvedValue(true);
      sessionRepo.update.mockResolvedValue(undefined);

      await service.togglePin('sess-1', 'user-1', true);

      expect(sessionRepo.update).toHaveBeenCalledWith('sess-1', { isPinned: true });
    });

    it('should set isPinned to false', async () => {
      sessionRepo.verifyOwnership.mockResolvedValue(true);
      sessionRepo.update.mockResolvedValue(undefined);

      await service.togglePin('sess-1', 'user-1', false);

      expect(sessionRepo.update).toHaveBeenCalledWith('sess-1', { isPinned: false });
    });

    it('should throw ForbiddenError for non-owner', async () => {
      sessionRepo.verifyOwnership.mockResolvedValue(false);

      await expect(service.togglePin('sess-1', 'user-bad', true)).rejects.toThrow(ForbiddenError);
    });
  });

  // =========================================================================
  // toggleShare
  // =========================================================================
  describe('toggleShare', () => {
    it('should set isShared to true with 1-hour expiry', async () => {
      sessionRepo.verifyOwnership.mockResolvedValue(true);
      sessionRepo.update.mockResolvedValue(undefined);

      const before = Date.now();
      await service.toggleShare('sess-1', 'user-1', true);
      const after = Date.now();

      expect(sessionRepo.update).toHaveBeenCalledWith('sess-1', {
        isShared: true,
        shareExpiresAt: expect.any(Date),
      });

      const call = sessionRepo.update.mock.calls[0];
      const expiryDate = call[1].shareExpiresAt as Date;
      const expiryMs = expiryDate.getTime();

      // Should be ~1 hour from now
      expect(expiryMs).toBeGreaterThanOrEqual(before + 60 * 60 * 1000 - 100);
      expect(expiryMs).toBeLessThanOrEqual(after + 60 * 60 * 1000 + 100);
    });

    it('should set isShared to false with null expiry', async () => {
      sessionRepo.verifyOwnership.mockResolvedValue(true);
      sessionRepo.update.mockResolvedValue(undefined);

      await service.toggleShare('sess-1', 'user-1', false);

      expect(sessionRepo.update).toHaveBeenCalledWith('sess-1', {
        isShared: false,
        shareExpiresAt: null,
      });
    });

    it('should throw ForbiddenError for non-owner', async () => {
      sessionRepo.verifyOwnership.mockResolvedValue(false);

      await expect(service.toggleShare('sess-1', 'user-bad', true)).rejects.toThrow(ForbiddenError);
      expect(sessionRepo.update).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // deleteSession
  // =========================================================================
  describe('deleteSession', () => {
    it('should delete session when user owns it', async () => {
      sessionRepo.verifyOwnership.mockResolvedValue(true);
      sessionRepo.delete.mockResolvedValue(undefined);

      await service.deleteSession('sess-1', 'user-1');

      expect(sessionRepo.verifyOwnership).toHaveBeenCalledWith('sess-1', 'user-1');
      expect(sessionRepo.delete).toHaveBeenCalledWith('sess-1');
    });

    it('should throw ForbiddenError when user does not own the session', async () => {
      sessionRepo.verifyOwnership.mockResolvedValue(false);

      await expect(service.deleteSession('sess-1', 'user-bad')).rejects.toThrow(ForbiddenError);
      expect(sessionRepo.delete).not.toHaveBeenCalled();
    });
  });
});
