/**
 * Session Service
 *
 * Business logic layer for session operations.
 * Uses Repositories for data access and encapsulates all session-related logic.
 */

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
    }));
  }

  /**
   * Get all sessions for a user (without messages)
   */
  async getUserSessions(userId: string): Promise<ChatSession[]> {
    const sessions = await this.sessionRepo.findAllByUserId(userId);
    const courseService = getCourseService();
    const allCourses = await courseService.getAllCourses();
    const courseMap = new Map(allCourses.map((c) => [c.id, c]));

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
