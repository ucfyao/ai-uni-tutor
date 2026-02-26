import { afterEach, describe, expect, it, vi } from 'vitest';

const mockHighlighter = {
  codeToTokens: vi.fn().mockReturnValue({
    tokens: [[{ content: 'const', color: '#FF0000' }]],
  }),
  getLoadedLanguages: vi.fn().mockReturnValue(['javascript']),
  loadLanguage: vi.fn().mockResolvedValue(undefined),
};

vi.mock('shiki/core', () => ({
  createHighlighterCore: vi.fn().mockResolvedValue(mockHighlighter),
}));

vi.mock('shiki/engine/javascript', () => ({
  createJavaScriptRegexEngine: vi.fn().mockReturnValue({}),
}));

describe('shiki singleton', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('should return the same highlighter instance on multiple calls', async () => {
    const { getHighlighter } = await import('./shiki');
    const h1 = await getHighlighter();
    const h2 = await getHighlighter();
    expect(h1).toBe(h2);
  });

  it('should highlight code tokens', async () => {
    const { highlightCode } = await import('./shiki');
    const result = await highlightCode('const x = 1', 'javascript');
    expect(result).toBeDefined();
    expect(result.tokens.length).toBeGreaterThan(0);
  });
});
