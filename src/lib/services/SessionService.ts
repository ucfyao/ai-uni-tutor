/**
 * Session Service
 *
 * Business logic layer for session operations.
 * Uses Repositories for data access and encapsulates all session-related logic.
 */

import { ForbiddenError } from '@/lib/errors';
import { getMessageRepository, getSessionRepository } from '@/lib/repositories';
import { inferParentChain, type MessageRepository } from '@/lib/repositories/MessageRepository';
import { getMockExamRepository } from '@/lib/repositories/MockExamRepository';
import type { SessionRepository } from '@/lib/repositories/SessionRepository';
import { getCourseService } from '@/lib/services/CourseService';
import { ChatMessage, ChatSession, Course, TutoringMode } from '@/types';
import type { MessageEntity } from '@/types/message';

/** Helper: convert MessageEntity to ChatMessage */
function toChat(m: MessageEntity): ChatMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.createdAt.getTime(),
    parentMessageId: m.parentMessageId,
  };
}

/**
 * Build siblingsMap from a list of (possibly inferred) messages.
 * Returns only fork points where a parent has >1 child.
 */
function buildSiblingsMap(messages: MessageEntity[]): Record<string, string[]> {
  const childrenMap = new Map<string, string[]>();
  for (const msg of messages) {
    const key = msg.parentMessageId ?? '__root__';
    const children = childrenMap.get(key) ?? [];
    children.push(msg.id);
    childrenMap.set(key, children);
  }
  const result: Record<string, string[]> = {};
  for (const [key, children] of childrenMap) {
    if (key !== '__root__' && children.length > 1) {
      result[key] = children;
    }
  }
  return result;
}

export class SessionService {
  private readonly sessionRepo: SessionRepository;
  private readonly messageRepo: MessageRepository;

  constructor(sessionRepo?: SessionRepository, messageRepo?: MessageRepository) {
    this.sessionRepo = sessionRepo ?? getSessionRepository();
    this.messageRepo = messageRepo ?? getMessageRepository();
  }

  /**
   * Resolve a courseId to a full Course object via CourseService
   */
  private async resolveCourse(courseId: string | null): Promise<Course | null> {
    if (!courseId) return null;
    const courseService = getCourseService();
    const entity = await courseService.getCourseById(courseId);
    if (!entity) return null;
    return {
      id: entity.id,
      universityId: entity.universityId,
      code: entity.code,
      name: entity.name,
    };
  }

  /**
   * Get a complete session with active-path messages + siblingsMap
   */
  async getFullSession(sessionId: string, userId: string): Promise<ChatSession | null> {
    const session = await this.sessionRepo.findByIdAndUserId(sessionId, userId);
    if (!session) return null;

    const [{ path, siblingsMap }, course] = await Promise.all([
      this.messageRepo.getActivePathWithForks(sessionId, session.activeLeafId),
      this.resolveCourse(session.courseId),
    ]);

    return {
      id: session.id,
      course,
      mode: session.mode,
      title: session.title,
      messages: path.map(toChat),
      siblingsMap,
      lastUpdated: session.updatedAt.getTime(),
      isPinned: session.isPinned,
      isShared: session.isShared,
    };
  }

  /**
   * Get only active-path messages for a session
   */
  async getSessionMessages(sessionId: string, userId: string): Promise<ChatMessage[] | null> {
    const session = await this.sessionRepo.findByIdAndUserId(sessionId, userId);
    if (!session) return null;

    const activePath = await this.messageRepo.getActivePath(sessionId, session.activeLeafId);
    return activePath.map(toChat);
  }

  /**
   * Get all sessions for a user (without messages)
   */
  async getUserSessions(userId: string): Promise<ChatSession[]> {
    const courseService = getCourseService();
    const [sessions, allCourses] = await Promise.all([
      this.sessionRepo.findAllByUserId(userId),
      courseService.getAllCourses(),
    ]);
    const courseMap = new Map<string, any>(allCourses.map((c) => [c.id, c]));

    // Batch-fetch mockId for Mock Exam sessions
    const examSessionIds = sessions.filter((s) => s.mode === 'Mock Exam').map((s) => s.id);
    const mockIdMap =
      examSessionIds.length > 0
        ? await getMockExamRepository().findMockIdsBySessionIds(examSessionIds)
        : new Map<string, string>();

    return sessions.map((s) => {
      const courseEntity = s.courseId ? courseMap.get(s.courseId) : null;
      return {
        id: s.id,
        course: courseEntity
          ? {
              id: courseEntity.id,
              universityId: courseEntity.universityId,
              code: courseEntity.code,
              name: courseEntity.name,
            }
          : null,
        mode: s.mode,
        title: s.title,
        messages: [], // Empty for list view - lazy loaded
        lastUpdated: s.updatedAt.getTime(),
        isPinned: s.isPinned,
        isShared: s.isShared,
        mockId: mockIdMap.get(s.id),
      };
    });
  }

  /**
   * Get a shared session (public access) — active path only
   */
  async getSharedSession(sessionId: string): Promise<ChatSession | null> {
    const session = await this.sessionRepo.findSharedById(sessionId);
    if (!session) return null;

    const [{ path, siblingsMap }, course] = await Promise.all([
      this.messageRepo.getActivePathWithForks(sessionId, session.activeLeafId),
      this.resolveCourse(session.courseId),
    ]);

    return {
      id: session.id,
      course,
      mode: session.mode,
      title: session.title,
      messages: path.map(toChat),
      siblingsMap,
      lastUpdated: session.updatedAt.getTime(),
      isPinned: session.isPinned,
      isShared: session.isShared,
    };
  }

  /**
   * Create a new session
   */
  async createSession(
    userId: string,
    courseId: string,
    mode: TutoringMode | null,
    title: string,
  ): Promise<ChatSession> {
    const entity = await this.sessionRepo.create({
      userId,
      courseId,
      mode,
      title,
    });
    const course = await this.resolveCourse(entity.courseId);

    return {
      id: entity.id,
      course,
      mode: entity.mode,
      title: entity.title,
      messages: [],
      lastUpdated: entity.updatedAt.getTime(),
      isPinned: entity.isPinned,
      isShared: entity.isShared,
    };
  }

  /**
   * Save a message to a session.
   * Passes client-provided id and parentMessageId to maintain the tree structure.
   */
  async saveMessage(sessionId: string, userId: string, message: ChatMessage): Promise<void> {
    // Verify ownership
    const hasAccess = await this.sessionRepo.verifyOwnership(sessionId, userId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not own this session');
    }

    await this.messageRepo.create({
      id: message.id,
      sessionId,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      parentMessageId: message.parentMessageId,
    });

    // Update session timestamp and track the latest message as active leaf
    await this.sessionRepo.update(sessionId, { activeLeafId: message.id });
  }

  /**
   * Update session title
   */
  async updateTitle(sessionId: string, userId: string, title: string): Promise<void> {
    const hasAccess = await this.sessionRepo.verifyOwnership(sessionId, userId);
    if (!hasAccess) throw new ForbiddenError();

    await this.sessionRepo.update(sessionId, { title });
  }

  /**
   * Update session mode
   */
  async updateMode(sessionId: string, userId: string, mode: TutoringMode): Promise<void> {
    const hasAccess = await this.sessionRepo.verifyOwnership(sessionId, userId);
    if (!hasAccess) throw new ForbiddenError();

    await this.sessionRepo.update(sessionId, { mode });
  }

  /**
   * Toggle pin status
   */
  async togglePin(sessionId: string, userId: string, isPinned: boolean): Promise<void> {
    const hasAccess = await this.sessionRepo.verifyOwnership(sessionId, userId);
    if (!hasAccess) throw new ForbiddenError();

    await this.sessionRepo.update(sessionId, { isPinned });
  }

  /**
   * Toggle share status
   */
  async toggleShare(sessionId: string, userId: string, isShared: boolean): Promise<void> {
    const hasAccess = await this.sessionRepo.verifyOwnership(sessionId, userId);
    if (!hasAccess) throw new ForbiddenError();

    // Set expiration to 1 hour from now if sharing, null if unsharing
    const shareExpiresAt = isShared ? new Date(Date.now() + 60 * 60 * 1000) : null;

    await this.sessionRepo.update(sessionId, { isShared, shareExpiresAt });
  }

  /**
   * Edit a user message and create a new conversation branch.
   * Creates a sibling message with the same parentMessageId as the original.
   * Uses inferParentChain for backward compatibility with legacy null-parent messages.
   */
  async editAndRegenerate(
    sessionId: string,
    userId: string,
    messageId: string,
    newContent: string,
  ): Promise<{
    newMessageId: string;
    messages: ChatMessage[];
    siblingsMap: Record<string, string[]>;
  }> {
    const session = await this.sessionRepo.findByIdAndUserId(sessionId, userId);
    if (!session) throw new ForbiddenError('Session not found or not owned by user');

    const allMessages = await this.messageRepo.findBySessionId(sessionId);
    // Infer parent chain for backward compat with legacy null-parent messages
    const inferred = inferParentChain(allMessages);
    const original = inferred.find((m) => m.id === messageId);
    if (!original) throw new Error('Message not found');
    if (original.role !== 'user') throw new Error('Can only edit user messages');

    // Create a new sibling: same parent_message_id as the original (using inferred parent)
    const newMsg = await this.messageRepo.create({
      sessionId,
      role: 'user',
      content: newContent,
      timestamp: Date.now(),
      parentMessageId: original.parentMessageId,
    });

    // Build the active path through the new message (getActivePath uses inferParentChain internally)
    const { path, siblingsMap } = await this.messageRepo.getActivePathWithForks(sessionId);

    // Persist the new branch leaf
    const leaf = path[path.length - 1];
    if (leaf) {
      await this.sessionRepo.update(sessionId, { activeLeafId: leaf.id });
    }

    return {
      newMessageId: newMsg.id,
      messages: path.map(toChat),
      siblingsMap,
    };
  }

  /**
   * Switch to a different conversation branch at a fork point.
   * Uses inferParentChain for backward compatibility.
   */
  async switchBranch(
    sessionId: string,
    userId: string,
    parentMessageId: string,
    targetChildId: string,
  ): Promise<{ messages: ChatMessage[]; siblingsMap: Record<string, string[]> }> {
    const session = await this.sessionRepo.findByIdAndUserId(sessionId, userId);
    if (!session) throw new ForbiddenError('Session not found');

    const allMessages = await this.messageRepo.findBySessionId(sessionId);
    const inferred = inferParentChain(allMessages);

    // Build parent→children map from inferred messages
    const childrenMap = new Map<string, MessageEntity[]>();
    for (const msg of inferred) {
      const key = msg.parentMessageId ?? '__root__';
      const list = childrenMap.get(key) ?? [];
      list.push(msg);
      childrenMap.set(key, list);
    }

    // Verify targetChildId is actually a child of parentMessageId (using inferred parents)
    const inferredChildren = childrenMap.get(parentMessageId) ?? [];
    const target = inferredChildren.find((c) => c.id === targetChildId);
    if (!target) throw new Error('Target message is not a child of the specified parent');

    // Build reverse lookup for walking up from parent
    const messageById = new Map<string, MessageEntity>();
    for (const msg of inferred) {
      messageById.set(msg.id, msg);
    }

    // Walk UP from parentMessageId to root to find the shared prefix
    const prefixReversed: MessageEntity[] = [];
    const visitedUp = new Set<string>();
    let walkUp: string | null = parentMessageId;
    while (walkUp) {
      if (visitedUp.has(walkUp)) {
        console.warn('[SessionService] Cycle detected walking up parent chain at:', walkUp);
        break;
      }
      visitedUp.add(walkUp);
      const msg = messageById.get(walkUp);
      if (!msg) break;
      prefixReversed.push(msg);
      walkUp = msg.parentMessageId;
    }
    const prefix = prefixReversed.reverse();

    // Build full path: prefix + target child + follow latest descendants to leaf
    const path: MessageEntity[] = [...prefix, target];
    const visitedDown = new Set<string>();
    let walkDown = targetChildId;
    while (true) {
      const kids = childrenMap.get(walkDown);
      if (!kids || kids.length === 0) break;
      const latest = kids[kids.length - 1];
      if (visitedDown.has(latest.id)) {
        console.warn('[SessionService] Cycle detected walking down tree at:', latest.id);
        break;
      }
      visitedDown.add(latest.id);
      path.push(latest);
      walkDown = latest.id;
    }

    // Compute siblingsMap from all inferred messages
    const siblingsMap = buildSiblingsMap(inferred);

    // Persist the selected branch leaf
    const leaf = path[path.length - 1];
    if (leaf) {
      await this.sessionRepo.update(sessionId, { activeLeafId: leaf.id });
    }

    return {
      messages: path.map(toChat),
      siblingsMap,
    };
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string, userId: string): Promise<void> {
    const hasAccess = await this.sessionRepo.verifyOwnership(sessionId, userId);
    if (!hasAccess) throw new ForbiddenError();

    await this.sessionRepo.delete(sessionId);
  }
}

// Singleton instance
let _sessionService: SessionService | null = null;

export function getSessionService(): SessionService {
  if (!_sessionService) {
    _sessionService = new SessionService();
  }
  return _sessionService;
}
