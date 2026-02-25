import { del, get, keys, set } from 'idb-keyval';
import type { ChatMessage } from '@/types';

const PREFIX = 'chat:';
const MAX_CACHED_SESSIONS = 50;

const isBrowser = () => typeof window !== 'undefined';

interface CachedSession {
  messages: ChatMessage[];
  lastSyncAt: string;
  version: number;
  lastAccessed: number;
}

function cacheKey(sessionId: string): string {
  return `${PREFIX}${sessionId}`;
}

export const chatCache = {
  async getMessages(sessionId: string): Promise<ChatMessage[] | null> {
    if (!isBrowser()) return null;
    try {
      const cached = await get<CachedSession>(cacheKey(sessionId));
      if (!cached) return null;
      await set(cacheKey(sessionId), { ...cached, lastAccessed: Date.now() });
      return cached.messages;
    } catch {
      return null;
    }
  },

  async getLastSyncAt(sessionId: string): Promise<string | null> {
    if (!isBrowser()) return null;
    try {
      const cached = await get<CachedSession>(cacheKey(sessionId));
      return cached?.lastSyncAt ?? null;
    } catch {
      return null;
    }
  },

  async saveMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    if (!isBrowser()) return;
    try {
      const lastMsg = messages[messages.length - 1];
      const lastSyncAt = lastMsg
        ? new Date(lastMsg.timestamp).toISOString()
        : new Date().toISOString();

      await set(cacheKey(sessionId), {
        messages,
        lastSyncAt,
        version: 1,
        lastAccessed: Date.now(),
      } satisfies CachedSession);

      await this.evictIfNeeded();
    } catch {
      // silent fail
    }
  },

  async clearSession(sessionId: string): Promise<void> {
    if (!isBrowser()) return;
    try {
      await del(cacheKey(sessionId));
    } catch {
      // silent
    }
  },

  async clearAll(): Promise<void> {
    if (!isBrowser()) return;
    try {
      const allKeys = await keys();
      const chatKeys = allKeys.filter((k) => typeof k === 'string' && k.startsWith(PREFIX));
      await Promise.all(chatKeys.map((k) => del(k)));
    } catch {
      // silent
    }
  },

  async evictIfNeeded(): Promise<void> {
    if (!isBrowser()) return;
    try {
      const allKeys = await keys();
      const chatKeys = allKeys.filter(
        (k) => typeof k === 'string' && k.startsWith(PREFIX),
      ) as string[];

      if (chatKeys.length <= MAX_CACHED_SESSIONS) return;

      const entries: { key: string; lastAccessed: number }[] = [];
      for (const key of chatKeys) {
        const cached = await get<CachedSession>(key);
        entries.push({ key, lastAccessed: cached?.lastAccessed ?? 0 });
      }

      entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
      const toRemove = entries.slice(0, entries.length - MAX_CACHED_SESSIONS);
      await Promise.all(toRemove.map((e) => del(e.key)));
    } catch {
      // silent
    }
  },
};
