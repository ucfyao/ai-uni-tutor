import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();
const mockKeys = vi.fn();

vi.mock('idb-keyval', () => ({
  get: (...args: unknown[]) => mockGet(...args),
  set: (...args: unknown[]) => mockSet(...args),
  del: (...args: unknown[]) => mockDel(...args),
  keys: (...args: unknown[]) => mockKeys(...args),
}));

const { chatCache } = await import('./chat-cache');

describe('chatCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return null for missing session', async () => {
    mockGet.mockResolvedValue(undefined);
    const result = await chatCache.getMessages('sess-1');
    expect(result).toBeNull();
  });

  it('should save and return messages', async () => {
    const messages = [{ id: 'msg-1', role: 'user', content: 'hi', timestamp: 1 }];
    mockSet.mockResolvedValue(undefined);
    mockKeys.mockResolvedValue(['chat:sess-1']);
    await chatCache.saveMessages('sess-1', messages as any);
    expect(mockSet).toHaveBeenCalledWith('chat:sess-1', expect.objectContaining({ messages }));
  });

  it('should clear a session', async () => {
    mockDel.mockResolvedValue(undefined);
    await chatCache.clearSession('sess-1');
    expect(mockDel).toHaveBeenCalledWith('chat:sess-1');
  });

  it('should clear all sessions', async () => {
    mockKeys.mockResolvedValue(['chat:sess-1', 'chat:sess-2', 'other-key']);
    mockDel.mockResolvedValue(undefined);
    await chatCache.clearAll();
    expect(mockDel).toHaveBeenCalledTimes(2);
  });
});
