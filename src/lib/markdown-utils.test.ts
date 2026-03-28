import { describe, expect, it } from 'vitest';
import { fixIncompleteMarkdown, normalizeMathDelimiters } from './markdown-utils';

describe('normalizeMathDelimiters', () => {
  it('should convert \\(...\\) to $...$', () => {
    expect(normalizeMathDelimiters('The value is \\(x^2\\).')).toBe('The value is $x^2$.');
  });

  it('should convert \\[...\\] to $$...$$', () => {
    expect(normalizeMathDelimiters('Block: \\[x + 1\\]')).toBe('Block: $$x + 1$$');
  });

  it('should wrap bare subscripts in $...$', () => {
    expect(normalizeMathDelimiters('binary 1101_2')).toBe('binary $1101_2$');
  });

  it('should wrap parenthesized subscript notation in $...$', () => {
    const input = 'Alternatively, (1101)_2=13 and (1011)_2=11.';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe('Alternatively, $(1101)_2$=13 and $(1011)_2$=11.');
  });

  it('should wrap bare backslash commands in $...$', () => {
    expect(normalizeMathDelimiters('value \\frac{1}{2} end')).toBe('value $\\frac{1}{2}$ end');
  });

  it('should not double-wrap already delimited math', () => {
    expect(normalizeMathDelimiters('$x^2$ and $\\frac{1}{2}$')).toBe('$x^2$ and $\\frac{1}{2}$');
  });

  it('should wrap \\begin{array}...\\end{array} in $$ block math', () => {
    const input = 'Result:\n\\begin{array}{c} 1 \\\\ 2 \\end{array}\nDone.';
    const result = normalizeMathDelimiters(input);
    expect(result).toContain('$$\\begin{array}{c} 1 \\\\ 2 \\end{array}$$');
  });

  it('should wrap \\begin{cases}...\\end{cases} in $$ block math', () => {
    const input = '\\begin{cases} x & y \\\\ a & b \\end{cases}';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe('$$\\begin{cases} x & y \\\\ a & b \\end{cases}$$');
  });

  it('should not wrap environments already inside $...$', () => {
    const input = '$\\begin{array}{c} 1 \\end{array}$';
    expect(normalizeMathDelimiters(input)).toBe(input);
  });

  it('should not wrap environments already inside $$...$$', () => {
    const input = '$$\\begin{array}{c} 1 \\end{array}$$';
    expect(normalizeMathDelimiters(input)).toBe(input);
  });

  it('should handle binary addition array from Gemini', () => {
    const input =
      '\\begin{array}{c} 1111 & \\text{(carries)} \\\\ 1101 & \\\\ + 1011 & \\\\ \\hline 11000 & \\\\ \\end{array}';
    const result = normalizeMathDelimiters(input);
    expect(result).toMatch(/^\$\$\\begin\{array\}/);
    expect(result).toMatch(/\\end\{array\}\$\$$/);
  });

  it('should not touch math inside code blocks', () => {
    const input = '```\n\\frac{1}{2}\n```';
    expect(normalizeMathDelimiters(input)).toBe(input);
  });

  it('should handle nested braces in \\frac', () => {
    const input = '\\frac{\\partial P_{ik}}{\\partial w_c}';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe('$\\frac{\\partial P_{ik}}{\\partial w_c}$');
  });

  it('should handle deeply nested braces', () => {
    const input = '\\frac{\\sum_{i=1}^{n} x_{i}}{\\sqrt{n}}';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe('$\\frac{\\sum_{i=1}^{n} x_{i}}{\\sqrt{n}}$');
  });

  it('should chain backslash commands with operators', () => {
    const input = '\\frac{1}{2} + \\frac{3}{4}';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe('$\\frac{1}{2} + \\frac{3}{4}$');
  });

  it('should handle command with subscript after braces', () => {
    const input = '\\sum_{i=1}^{n}';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe('$\\sum_{i=1}^{n}$');
  });

  it('should handle complex softmax derivative', () => {
    const input = '\\frac{\\partial J}{\\partial w_c} = -\\sum_{i=1}^{n} (P_{ic} - Y_{ic}) x_i';
    const result = normalizeMathDelimiters(input);
    // All LaTeX commands should be inside $...$
    expect(result).toMatch(/^\$/); // starts with $
    expect(result).toContain('$\\frac{\\partial J}{\\partial w_c}');
    expect(result).toContain('$P_{ic}$');
    expect(result).toContain('$Y_{ic}$');
    expect(result).toContain('$x_i$');
  });

  it('should handle standalone commands like \\cdot and \\times', () => {
    const input = 'a \\cdot b';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe('a $\\cdot$ b');
  });

  it('should not corrupt mixed text and LaTeX', () => {
    const input = '求 \\frac{\\partial J}{\\partial w_c} 的值';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe('求 $\\frac{\\partial J}{\\partial w_c}$ 的值');
  });
});

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
