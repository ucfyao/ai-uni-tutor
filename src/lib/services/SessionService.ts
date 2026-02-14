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
import { ChatMessage, ChatSession, Course, TutoringMode } from '@/types';

export class SessionService {
  private readonly sessionRepo: SessionRepository;
  private readonly messageRepo: MessageRepository;

  constructor(sessionRepo?: SessionRepository, messageRepo?: MessageRepository) {
    this.sessionRepo = sessionRepo ?? getSessionRepository();
    this.messageRepo = messageRepo ?? getMessageRepository();
  }

  /**
   * Get a complete session with all messages
   */
  async getFullSession(sessionId: string, userId: string): Promise<ChatSession | null> {
    const session = await this.sessionRepo.findByIdAndUserId(sessionId, userId);
    if (!session) return null;

    const messageEntities = await this.messageRepo.findBySessionId(sessionId);

    return {
      id: session.id,
      course: session.course,
      mode: session.mode,
      title: session.title,
      messages: messageEntities.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.createdAt.getTime(),
        cardId: m.cardId ?? undefined,
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
      cardId: m.cardId ?? undefined,
    }));
  }

  /**
   * Get all sessions for a user (without messages)
   */
  async getUserSessions(userId: string): Promise<ChatSession[]> {
    const sessions = await this.sessionRepo.findAllByUserId(userId);

    return sessions.map((s) => ({
      id: s.id,
      course: s.course,
      mode: s.mode,
      title: s.title,
      messages: [], // Empty for list view - lazy loaded
      lastUpdated: s.updatedAt.getTime(),
      isPinned: s.isPinned,
      isShared: s.isShared,
    }));
  }

  /**
   * Get a shared session (public access)
   */
  async getSharedSession(sessionId: string): Promise<ChatSession | null> {
    const session = await this.sessionRepo.findSharedById(sessionId);
    if (!session) return null;

    const messageEntities = await this.messageRepo.findBySessionId(sessionId);

    return {
      id: session.id,
      course: session.course,
      mode: session.mode,
      title: session.title,
      messages: messageEntities.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.createdAt.getTime(),
        cardId: m.cardId ?? undefined,
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
    course: Course,
    mode: TutoringMode | null,
    title: string,
  ): Promise<ChatSession> {
    const entity = await this.sessionRepo.create({
      userId,
      course,
      mode,
      title,
    });

    return {
      id: entity.id,
      course: entity.course,
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
      cardId: message.cardId,
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
