import { describe, expect, it } from 'vitest';
import { fixIncompleteMarkdown } from './markdown-utils';

describe('fixIncompleteMarkdown', () => {
  it('should not modify complete markdown', () => {
    const input = 'Hello world\n```python\nprint("hi")\n```\n';
    expect(fixIncompleteMarkdown(input)).toBe(input);
  });

  it('should close unclosed code fence', () => {
    const input = 'Here is code:\n```python\nprint("hi")';
    const result = fixIncompleteMarkdown(input);
    expect(result).toBe('Here is code:\n```python\nprint("hi")\n```');
  });

  it('should not close already paired fences', () => {
    const input = '```js\nconst x = 1\n```\ntext\n```py\ny = 2\n```';
    expect(fixIncompleteMarkdown(input)).toBe(input);
  });

  it('should close unclosed inline code', () => {
    const input = 'Use the `useState hook';
    const result = fixIncompleteMarkdown(input);
    expect(result).toBe('Use the `useState hook`');
  });

  it('should not modify paired inline code', () => {
    const input = 'Use `useState` and `useEffect` hooks';
    expect(fixIncompleteMarkdown(input)).toBe(input);
  });

  it('should ignore backticks inside fenced blocks', () => {
    const input = '```\nconst x = `template`\n```\nsome `open';
    const result = fixIncompleteMarkdown(input);
    expect(result).toContain('`open`');
  });

  it('should handle empty string', () => {
    expect(fixIncompleteMarkdown('')).toBe('');
  });

  it('should handle triple backtick with language tag', () => {
    const input = 'text\n```typescript\nconst x: number = 1';
    const result = fixIncompleteMarkdown(input);
    expect(result.endsWith('\n```')).toBe(true);
  });
});
