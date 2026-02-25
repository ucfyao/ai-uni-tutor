/**
 * Session Service
 *
 * Business logic layer for session operations.
 * Uses Repositories for data access and encapsulates all session-related logic.
 */

import type { MessageEntity } from '@/lib/domain/models/Message';
import { ForbiddenError } from '@/lib/errors';
import { getMessageRepository, getSessionRepository } from '@/lib/repositories';
import type { MessageRepository } from '@/lib/repositories/MessageRepository';
import type { SessionRepository } from '@/lib/repositories/SessionRepository';
import { getCourseService } from '@/lib/services/CourseService';
import { ChatMessage, ChatSession, Course, TutoringMode } from '@/types';

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
   * Get a complete session with all messages
   */
  async getFullSession(sessionId: string, userId: string): Promise<ChatSession | null> {
    const session = await this.sessionRepo.findByIdAndUserId(sessionId, userId);
    if (!session) return null;

    const messageEntities = await this.messageRepo.findBySessionId(sessionId);
    const course = await this.resolveCourse(session.courseId);

    return {
      id: session.id,
      course,
      mode: session.mode,
      title: session.title,
      messages: messageEntities.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.createdAt.getTime(),
        parentMessageId: m.parentMessageId,
      })),
      lastUpdated: session.updatedAt.getTime(),
      isPinned: session.isPinned,
      isShared: session.isShared,
    };
  }

  /**
   * Get only messages for a session (assumes ownership already verified)
   */
  async getSessionMessages(sessionId: string, userId: string): Promise<ChatMessage[] | null> {
    // Verify ownership first
    const hasAccess = await this.sessionRepo.verifyOwnership(sessionId, userId);
    if (!hasAccess) return null;

    const messageEntities = await this.messageRepo.findBySessionId(sessionId);

    return messageEntities.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.createdAt.getTime(),
      parentMessageId: m.parentMessageId,
    }));
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
      };
    });
  }

  /**
   * Get a shared session (public access)
   */
  async getSharedSession(sessionId: string): Promise<ChatSession | null> {
    const session = await this.sessionRepo.findSharedById(sessionId);
    if (!session) return null;

    const messageEntities = await this.messageRepo.findBySessionId(sessionId);
    const course = await this.resolveCourse(session.courseId);

    return {
      id: session.id,
      course,
      mode: session.mode,
      title: session.title,
      messages: messageEntities.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.createdAt.getTime(),
        parentMessageId: m.parentMessageId,
      })),
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
   * Save a message to a session
   */
  async saveMessage(sessionId: string, userId: string, message: ChatMessage): Promise<void> {
    // Verify ownership
    const hasAccess = await this.sessionRepo.verifyOwnership(sessionId, userId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not own this session');
    }

    await this.messageRepo.create({
      sessionId,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
    });

    // Update session timestamp once per turn (not per message)
    await this.sessionRepo.update(sessionId, {});
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
   */
  async editAndRegenerate(
    sessionId: string,
    userId: string,
    messageId: string,
    newContent: string,
  ): Promise<{ newMessageId: string; messages: ChatMessage[] }> {
    const session = await this.sessionRepo.findByIdAndUserId(sessionId, userId);
    if (!session) throw new ForbiddenError('Session not found or not owned by user');

    const allMessages = await this.messageRepo.findBySessionId(sessionId);
    const original = allMessages.find((m) => m.id === messageId);
    if (!original) throw new Error('Message not found');
    if (original.role !== 'user') throw new Error('Can only edit user messages');

    // Create a new sibling: same parent_message_id as the original
    const newMsg = await this.messageRepo.create({
      sessionId,
      role: 'user',
      content: newContent,
      timestamp: Date.now(),
      parentMessageId: original.parentMessageId,
    });

    // Build the active path through the new message
    const activePath = await this.messageRepo.getActivePath(sessionId);

    const messages = activePath.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.createdAt.getTime(),
      parentMessageId: m.parentMessageId,
    }));

    return { newMessageId: newMsg.id, messages };
  }

  /**
   * Switch to a different conversation branch at a fork point.
   */
  async switchBranch(
    sessionId: string,
    userId: string,
    parentMessageId: string,
    targetChildId: string,
  ): Promise<ChatMessage[]> {
    const session = await this.sessionRepo.findByIdAndUserId(sessionId, userId);
    if (!session) throw new ForbiddenError('Session not found');

    // Verify targetChildId is actually a child of parentMessageId
    const children = await this.messageRepo.getChildren(parentMessageId);
    const target = children.find((c) => c.id === targetChildId);
    if (!target) throw new Error('Target message is not a child of the specified parent');

    const allMessages = await this.messageRepo.findBySessionId(sessionId);

    // Build parent→children map
    const childrenMap = new Map<string, MessageEntity[]>();
    for (const msg of allMessages) {
      const key = msg.parentMessageId ?? '__root__';
      const list = childrenMap.get(key) ?? [];
      list.push(msg);
      childrenMap.set(key, list);
    }

    // Build reverse lookup for walking up from parent
    const messageById = new Map<string, MessageEntity>();
    for (const msg of allMessages) {
      messageById.set(msg.id, msg);
    }

    // Walk UP from parentMessageId to root to find the shared prefix
    const prefixReversed: MessageEntity[] = [];
    let walkUp: string | null = parentMessageId;
    while (walkUp) {
      const msg = messageById.get(walkUp);
      if (!msg) break;
      prefixReversed.push(msg);
      walkUp = msg.parentMessageId;
    }
    const prefix = prefixReversed.reverse();

    // Build full path: prefix + target child + follow latest descendants to leaf
    const path: MessageEntity[] = [...prefix, target];
    let walkDown = targetChildId;
    while (true) {
      const kids = childrenMap.get(walkDown);
      if (!kids || kids.length === 0) break;
      const latest = kids[kids.length - 1];
      path.push(latest);
      walkDown = latest.id;
    }

    return path.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.createdAt.getTime(),
      parentMessageId: m.parentMessageId,
    }));
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
