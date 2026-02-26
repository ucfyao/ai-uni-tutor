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
