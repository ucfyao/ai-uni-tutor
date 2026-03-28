/**
 * Normalize LaTeX delimiters to dollar-sign form that remark-math understands.
 *
 * 1. Converts \(...\) → $...$ and \[...\] → $$...$$.
 * 2. Detects bare LaTeX (commands like \frac, \text, subscripts/superscripts
 *    outside of $...$) and wraps them in inline math delimiters.
 *
 * Skips content inside fenced code blocks, inline code, and existing $...$ regions.
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
      // Environment pairs: \begin{env}...\end{env} → $$...$$ (block math)
      // Must run BEFORE wrapBareLaTeX so the $$...$$ is recognized as math
      parts[i] = wrapBareEnvironments(parts[i]);
      // Bare LaTeX outside $...$: wrap in $...$
      // Also skip inline code (`...`) to avoid corrupting code identifiers
      parts[i] = skipInlineCode(parts[i], wrapBareLaTeX);
    }
  }
  return parts.join('');
}

/**
 * Split text by inline code spans (`...`), apply a transform only to
 * non-code segments, then reassemble.
 */
function skipInlineCode(text: string, transform: (s: string) => string): string {
  const segments = text.split(/(`[^`]+`)/g);
  for (let i = 0; i < segments.length; i++) {
    if (i % 2 === 0) {
      segments[i] = transform(segments[i]);
    }
  }
  return segments.join('');
}

/**
 * Wrap bare \begin{env}...\end{env} pairs (outside existing $/$$ delimiters)
 * in $$...$$ block math. Must run before wrapBareLaTeX so the resulting $$
 * delimiters are correctly recognized as math regions.
 */
function wrapBareEnvironments(text: string): string {
  // Split into math ($...$, $$...$$) and non-math segments
  const segments = text.split(/(\$\$[\s\S]*?\$\$|\$[^$]*?\$)/g);

  for (let i = 0; i < segments.length; i++) {
    if (i % 2 === 0 && segments[i]) {
      segments[i] = segments[i].replace(
        /\\begin\{([^}]+)\}[\s\S]*?\\end\{\1\}/g,
        (match) => `$$${match}$$`,
      );
    }
  }
  return segments.join('');
}

/**
 * Find bare LaTeX outside of $...$ / $$...$$ and wrap in inline math.
 *
 * Targets two safe, high-confidence patterns:
 *  1. Subscript/superscript: e.g. 101101_2, x^2, a_{n+1}
 *  2. Backslash commands:    e.g. \frac{1}{2}, \text{AND}, \sqrt{x}
 *
 * Safety: If $$ delimiters are unbalanced (AI forgot to close a $$), inserting
 * new $ signs would mispair with the orphaned $$. Detect this and bail out.
 */
function wrapBareLaTeX(text: string): string {
  // Count $$ pairs — if odd, delimiters are unbalanced; skip wrapping to avoid
  // making things worse (an inserted $ would pair with the orphaned $$).
  const ddCount = countNonOverlapping(text, '$$');
  if (ddCount % 2 !== 0) return text;

  // Split into math ($...$, $$...$$) and non-math segments
  const segments = text.split(/(\$\$[\s\S]*?\$\$|\$[^$]*?\$)/g);

  for (let i = 0; i < segments.length; i++) {
    if (i % 2 === 0 && segments[i]) {
      // 0. Parenthesized base with sub/superscripts, e.g. (1101)_2, (x+1)^{2}
      segments[i] = segments[i].replace(
        /(\([^()\n]+\)\s*(?:[_^](?:\{[^}\n]+\}|\w))+)/g,
        (match) => `$${match}$`,
      );

      // 1. Subscripts/superscripts: word_sub or word^sup (e.g. 101101_2, x_{n+1}, 2^{10})
      //    Only match when the subscript/superscript is a single char NOT followed by
      //    more word chars (to avoid matching code identifiers like train_test_split).
      segments[i] = segments[i].replace(
        /\b(\w+(?:[_^](?:\{[^}]+\}|\w(?!\w)))+)/g,
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

/** Count non-overlapping occurrences of a substring. */
function countNonOverlapping(text: string, sub: string): number {
  let count = 0;
  let idx = 0;
  while ((idx = text.indexOf(sub, idx)) !== -1) {
    count++;
    idx += sub.length;
  }
  return count;
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
