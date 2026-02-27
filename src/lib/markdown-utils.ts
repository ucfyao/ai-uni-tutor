/**
 * Normalize LaTeX delimiters to dollar-sign form that remark-math understands.
 *
 * 1. Converts \(...\) → $...$ and \[...\] → $$...$$.
 * 2. Detects bare LaTeX (commands like \frac, \text, subscripts/superscripts
 *    outside of $...$) and wraps them in inline math delimiters.
 *
 * Skips content inside fenced code blocks and existing $...$ regions.
 */
export function normalizeMathDelimiters(content: string): string {
  if (!content) return content;

  // Split by fenced code blocks so we don't touch math inside ```...```
  const parts = content.split(/(```[\s\S]*?```)/g);
  for (let i = 0; i < parts.length; i++) {
    // Only process non-code-block parts (even indices)
    if (i % 2 === 0) {
      // Block math: \[...\] → $$...$$  (may span multiple lines)
      parts[i] = parts[i].replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
      // Inline math: \(...\) → $...$
      parts[i] = parts[i].replace(/\\\((.*?)\\\)/g, '$$$1$$');
      // Bare LaTeX outside $...$: wrap in $...$
      parts[i] = wrapBareLaTeX(parts[i]);
    }
  }
  return parts.join('');
}

/**
 * Find bare LaTeX outside of $...$ / $$...$$ and wrap in inline math.
 *
 * Targets two safe, high-confidence patterns:
 *  1. Subscript/superscript: e.g. 101101_2, x^2, a_{n+1}
 *  2. Backslash commands:    e.g. \frac{1}{2}, \text{AND}, \sqrt{x}
 */
function wrapBareLaTeX(text: string): string {
  // Split into math ($...$, $$...$$) and non-math segments
  const segments = text.split(/(\$\$[\s\S]*?\$\$|\$[^$]*?\$)/g);

  for (let i = 0; i < segments.length; i++) {
    if (i % 2 === 0 && segments[i]) {
      // 1. Subscripts/superscripts: word_sub or word^sup (e.g. 101101_2, x_{n+1}, 2^{10})
      segments[i] = segments[i].replace(
        /\b(\w+(?:[_^](?:\{[^}]+\}|\w))+)/g,
        (match) => `$${match}$`,
      );

      // 2. Backslash commands: \cmd or \cmd{...}{...}... possibly chained
      //    e.g. \frac{1}{2}, \text{AND}, \sqrt{x}, \cdot, \times
      segments[i] = segments[i].replace(
        /\\[a-zA-Z]+(?:\{[^}]*\})*(?:\s*[+\-=<>·×*/]\s*\\[a-zA-Z]+(?:\{[^}]*\})*)*/g,
        (match) => `$${match}$`,
      );
    }
  }
  return segments.join('');
}

/**
 * Fix incomplete markdown during streaming.
 * Only fixes code fences and inline code (high impact, low false-positive risk).
 */
export function fixIncompleteMarkdown(content: string): string {
  if (!content) return content;

  let result = content;

  // 1. Fix unclosed code fences
  const fenceRegex = /^`{3,}/gm;
  let fenceCount = 0;
  while (fenceRegex.exec(result) !== null) {
    fenceCount++;
  }
  if (fenceCount % 2 !== 0) {
    result = result + '\n```';
  }

  // 2. Fix unclosed inline backticks (outside fenced blocks)
  const parts = result.split(/^`{3,}.*$/gm);
  let inlineBacktickCount = 0;
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      const backticks = parts[i].match(/`/g);
      if (backticks) inlineBacktickCount += backticks.length;
    }
  }
  if (inlineBacktickCount % 2 !== 0) {
    result = result + '`';
  }

  return result;
}
