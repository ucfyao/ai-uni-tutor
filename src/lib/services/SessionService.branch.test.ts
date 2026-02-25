/**
 * SessionService Branching Tests
 *
 * Tests for editAndRegenerate and switchBranch methods.
 * Uses constructor DI to inject mock repositories.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageEntity } from '@/lib/domain/models/Message';

// ── Mocks ──

const mockSessionRepo = {
  findByIdAndUserId: vi.fn(),
  verifyOwnership: vi.fn(),
  findAllByUserId: vi.fn(),
  findSharedById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockMessageRepo = {
  findBySessionId: vi.fn(),
  create: vi.fn(),
  getChildren: vi.fn(),
  getActivePath: vi.fn(),
};

// Mock CourseService (required by SessionService constructor path)
vi.mock('@/lib/services/CourseService', () => ({
  getCourseService: () => ({ getCourseById: vi.fn(), getAllCourses: vi.fn() }),
}));

// Mock repository singletons (not used since we pass via constructor, but needed for imports)
vi.mock('@/lib/repositories', () => ({
  getSessionRepository: () => mockSessionRepo,
  getMessageRepository: () => mockMessageRepo,
}));

const { SessionService } = await import('./SessionService');

// ── Helpers ──

function makeMsg(
  id: string,
  parentId: string | null,
  role: 'user' | 'assistant' = 'user',
  content = `content-${id}`,
  createdAt = '2025-06-01T10:00:00Z',
): MessageEntity {
  return {
    id,
    sessionId: 'sess-1',
    role,
    content,
    createdAt: new Date(createdAt),
    parentMessageId: parentId,
  };
}

describe('SessionService branching', () => {
  let service: InstanceType<typeof SessionService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SessionService(mockSessionRepo as any, mockMessageRepo as any);
    mockSessionRepo.findByIdAndUserId.mockResolvedValue({ id: 'sess-1' });
  });

  // =========================================================================
  // editAndRegenerate
  // =========================================================================
  describe('editAndRegenerate', () => {
    it('should create a new sibling with same parentMessageId as original', async () => {
      const msg1 = makeMsg('msg-1', null, 'assistant', 'hi', '2025-06-01T10:00:00Z');
      const msg2 = makeMsg('msg-2', 'msg-1', 'user', 'old question', '2025-06-01T10:01:00Z');

      mockMessageRepo.findBySessionId.mockResolvedValue([msg1, msg2]);
      mockMessageRepo.create.mockResolvedValue(
        makeMsg('msg-3', 'msg-1', 'user', 'new question', '2025-06-01T10:02:00Z'),
      );
      mockMessageRepo.getActivePath.mockResolvedValue([msg1, makeMsg('msg-3', 'msg-1')]);

      const result = await service.editAndRegenerate('sess-1', 'user-1', 'msg-2', 'new question');

      expect(result.newMessageId).toBe('msg-3');
      expect(mockMessageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ parentMessageId: 'msg-1' }),
      );
    });

    it('should NOT modify or delete the original message', async () => {
      const msg1 = makeMsg('msg-1', null, 'assistant');
      const msg2 = makeMsg('msg-2', 'msg-1', 'user', 'old');

      mockMessageRepo.findBySessionId.mockResolvedValue([msg1, msg2]);
      mockMessageRepo.create.mockResolvedValue(makeMsg('msg-3', 'msg-1', 'user', 'new'));
      mockMessageRepo.getActivePath.mockResolvedValue([]);

      await service.editAndRegenerate('sess-1', 'user-1', 'msg-2', 'new');

      // Only create should be called, no update or delete
      expect(mockMessageRepo.create).toHaveBeenCalledTimes(1);
    });

    it('should reject editing assistant messages', async () => {
      const assistantMsg = makeMsg('msg-2', 'msg-1', 'assistant', 'response');
      mockMessageRepo.findBySessionId.mockResolvedValue([assistantMsg]);

      await expect(service.editAndRegenerate('sess-1', 'user-1', 'msg-2', 'new')).rejects.toThrow(
        'Can only edit user messages',
      );
    });

    it('should reject when message not found', async () => {
      mockMessageRepo.findBySessionId.mockResolvedValue([]);

      await expect(
        service.editAndRegenerate('sess-1', 'user-1', 'nonexistent', 'new'),
      ).rejects.toThrow('Message not found');
    });

    it('should reject when session not owned by user', async () => {
      mockSessionRepo.findByIdAndUserId.mockResolvedValue(null);

      await expect(service.editAndRegenerate('sess-1', 'user-1', 'msg-1', 'new')).rejects.toThrow();
    });
  });

  // =========================================================================
  // switchBranch
  // =========================================================================
  describe('switchBranch', () => {
    it('should return correct path through selected sibling', async () => {
      // msg-root → msg-2a (child A), msg-2b (child B)
      const root = makeMsg('msg-root', null, 'user', 'root', '2025-06-01T10:00:00Z');
      const childA = makeMsg('msg-2a', 'msg-root', 'assistant', 'A', '2025-06-01T10:01:00Z');
      const childB = makeMsg('msg-2b', 'msg-root', 'assistant', 'B', '2025-06-01T10:02:00Z');

      mockMessageRepo.getChildren.mockResolvedValue([childA, childB]);
      mockMessageRepo.findBySessionId.mockResolvedValue([root, childA, childB]);

      const result = await service.switchBranch('sess-1', 'user-1', 'msg-root', 'msg-2a');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('msg-root');
      expect(result[1].id).toBe('msg-2a');
    });

    it('should share prefix across branches', async () => {
      // msg-1 → msg-2 → msg-3a / msg-3b
      const msg1 = makeMsg('msg-1', null, 'user', '1', '2025-06-01T10:00:00Z');
      const msg2 = makeMsg('msg-2', 'msg-1', 'assistant', '2', '2025-06-01T10:01:00Z');
      const msg3a = makeMsg('msg-3a', 'msg-2', 'user', '3a', '2025-06-01T10:02:00Z');
      const msg3b = makeMsg('msg-3b', 'msg-2', 'user', '3b', '2025-06-01T10:03:00Z');

      mockMessageRepo.getChildren.mockResolvedValue([msg3a, msg3b]);
      mockMessageRepo.findBySessionId.mockResolvedValue([msg1, msg2, msg3a, msg3b]);

      const resultA = await service.switchBranch('sess-1', 'user-1', 'msg-2', 'msg-3a');

      expect(resultA).toHaveLength(3);
      expect(resultA[0].id).toBe('msg-1'); // shared prefix
      expect(resultA[1].id).toBe('msg-2'); // shared prefix
      expect(resultA[2].id).toBe('msg-3a'); // selected branch
    });

    it('should follow latest descendants from target to leaf', async () => {
      // msg-root → msg-2a → msg-3 → msg-4
      const root = makeMsg('msg-root', null, 'user', 'root', '2025-06-01T10:00:00Z');
      const msg2a = makeMsg('msg-2a', 'msg-root', 'assistant', '2a', '2025-06-01T10:01:00Z');
      const msg2b = makeMsg('msg-2b', 'msg-root', 'assistant', '2b', '2025-06-01T10:02:00Z');
      const msg3 = makeMsg('msg-3', 'msg-2a', 'user', '3', '2025-06-01T10:03:00Z');
      const msg4 = makeMsg('msg-4', 'msg-3', 'assistant', '4', '2025-06-01T10:04:00Z');

      mockMessageRepo.getChildren.mockResolvedValue([msg2a, msg2b]);
      mockMessageRepo.findBySessionId.mockResolvedValue([root, msg2a, msg2b, msg3, msg4]);

      const result = await service.switchBranch('sess-1', 'user-1', 'msg-root', 'msg-2a');

      expect(result).toHaveLength(4);
      expect(result[0].id).toBe('msg-root');
      expect(result[1].id).toBe('msg-2a');
      expect(result[2].id).toBe('msg-3');
      expect(result[3].id).toBe('msg-4');
    });

    it('should reject if targetChildId is not a child of parentMessageId', async () => {
      mockMessageRepo.getChildren.mockResolvedValue([]);

      await expect(
        service.switchBranch('sess-1', 'user-1', 'parent-1', 'bad-child'),
      ).rejects.toThrow('Target message is not a child');
    });

    it('should reject when session not owned by user', async () => {
      mockSessionRepo.findByIdAndUserId.mockResolvedValue(null);

      await expect(
        service.switchBranch('sess-1', 'user-1', 'parent-1', 'child-1'),
      ).rejects.toThrow();
    });
  });
});
