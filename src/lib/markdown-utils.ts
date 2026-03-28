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
 * Match a brace-delimited group starting at `pos` (which must point at '{').
 * Handles arbitrary nesting depth. Returns the index AFTER the closing '}'.
 * Returns -1 if braces are unbalanced.
 */
function matchBraceGroup(text: string, pos: number): number {
  if (text[pos] !== '{') return -1;
  let depth = 1;
  let i = pos + 1;
  while (i < text.length && depth > 0) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') depth--;
    i++;
  }
  return depth === 0 ? i : -1;
}

/**
 * Starting at `pos`, consume zero or more consecutive brace groups `{...}`.
 * Returns the index after the last closing brace (or `pos` if none found).
 */
function consumeBraceGroups(text: string, pos: number): number {
  let end = pos;
  while (end < text.length && text[end] === '{') {
    const next = matchBraceGroup(text, end);
    if (next === -1) break;
    end = next;
  }
  return end;
}

/**
 * Match a backslash command with nested brace arguments at `pos`.
 * e.g. \frac{\partial P_{ik}}{\partial w_c}
 * Returns the end index or `pos` if no valid command found.
 */
function matchBackslashCommand(text: string, pos: number): number {
  if (text[pos] !== '\\') return pos;
  const cmdMatch = text.slice(pos).match(/^\\[a-zA-Z]+/);
  if (!cmdMatch) return pos;
  return consumeBraceGroups(text, pos + cmdMatch[0].length);
}

/**
 * Walk through text and wrap bare \cmd{...}{...} sequences (possibly chained
 * with operators or subscripts/superscripts) in $...$. Uses bracket-matching
 * for nested braces instead of regex.
 */
function wrapBackslashCommands(text: string): string {
  const result: string[] = [];
  let pos = 0;

  while (pos < text.length) {
    if (text[pos] === '\\' && pos + 1 < text.length && /[a-zA-Z]/.test(text[pos + 1])) {
      const cmdEnd = matchBackslashCommand(text, pos);
      if (cmdEnd > pos) {
        // Extend: chain operators, more commands, subscripts/superscripts
        let chainEnd = cmdEnd;
        while (chainEnd < text.length) {
          // Subscripts/superscripts directly after command
          if (text[chainEnd] === '_' || text[chainEnd] === '^') {
            const subEnd =
              text[chainEnd + 1] === '{'
                ? matchBraceGroup(text, chainEnd + 1)
                : chainEnd + 2 <= text.length
                  ? chainEnd + 2
                  : -1;
            if (subEnd > chainEnd) {
              chainEnd = subEnd;
              continue;
            }
          }
          // Operator + next command (e.g. \cdot \frac{...}{...}, = -\sum)
          // Allow multiple operator chars to handle patterns like "= -"
          const rest = text.slice(chainEnd);
          const opMatch = rest.match(/^(\s*(?:[+\-=<>·×*/,;]\s*)+)/);
          const nextStart = chainEnd + (opMatch ? opMatch[0].length : 0);
          if (nextStart < text.length && text[nextStart] === '\\') {
            const nextEnd = matchBackslashCommand(text, nextStart);
            if (nextEnd > nextStart) {
              chainEnd = nextEnd;
              continue;
            }
          }
          break;
        }
        result.push('$', text.slice(pos, chainEnd), '$');
        pos = chainEnd;
      } else {
        result.push(text[pos]);
        pos++;
      }
    } else {
      result.push(text[pos]);
      pos++;
    }
  }
  return result.join('');
}

/**
 * Apply a transform to non-math segments of text.
 * Splits by $...$  and $$...$$ regions, applies `fn` only outside math.
 */
function applyOutsideMath(text: string, fn: (s: string) => string): string {
  const segments = text.split(/(\$\$[\s\S]*?\$\$|\$[^$]*?\$)/g);
  for (let i = 0; i < segments.length; i++) {
    if (i % 2 === 0 && segments[i]) {
      segments[i] = fn(segments[i]);
    }
  }
  return segments.join('');
}

/**
 * Find bare LaTeX outside of $...$ / $$...$$ and wrap in inline math.
 *
 * Processing order matters — backslash commands run first so their brace
 * content is protected before the subscript regex sees it:
 *  1. Backslash commands with nested brace support (e.g. \frac{\partial P_{ik}}{\partial w_c})
 *  2. Parenthesized subscripts (e.g. (1101)_2)
 *  3. Plain subscripts/superscripts (e.g. x^2, a_{n+1})
 *
 * After each step we re-split by $...$ so later steps don't touch
 * content that was already wrapped.
 *
 * Safety: If $$ delimiters are unbalanced (AI forgot to close a $$), inserting
 * new $ signs would mispair with the orphaned $$. Detect this and bail out.
 */
function wrapBareLaTeX(text: string): string {
  // Count $$ pairs — if odd, delimiters are unbalanced; skip wrapping to avoid
  // making things worse (an inserted $ would pair with the orphaned $$).
  const ddCount = countNonOverlapping(text, '$$');
  if (ddCount % 2 !== 0) return text;

  // 1. Backslash commands first — these create $...$ regions that protect
  //    their brace content from later subscript matching.
  let result = applyOutsideMath(text, wrapBackslashCommands);

  // 2. Parenthesized base with sub/superscripts, e.g. (1101)_2, (x+1)^{2}
  result = applyOutsideMath(result, (s) =>
    s.replace(/(\([^()\n]+\)\s*(?:[_^](?:\{[^}\n]+\}|\w))+)/g, (match) => `$${match}$`),
  );

  // 3. Subscripts/superscripts: word_sub or word^sup (e.g. 101101_2, x_{n+1}, 2^{10})
  //    Only match when the subscript/superscript is a single char NOT followed by
  //    more word chars (to avoid matching code identifiers like train_test_split).
  result = applyOutsideMath(result, (s) =>
    s.replace(/\b(\w+(?:[_^](?:\{[^}]+\}|\w(?!\w)))+)/g, (match) => `$${match}$`),
  );

  return result;
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
