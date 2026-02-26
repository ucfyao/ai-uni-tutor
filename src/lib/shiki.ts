import type { HighlighterCore, ThemedToken } from 'shiki/core';

let highlighterPromise: Promise<HighlighterCore> | null = null;

const PRELOAD_LANGS = [
  'python',
  'javascript',
  'typescript',
  'java',
  'c',
  'cpp',
  'sql',
  'r',
  'matlab',
  'html',
  'css',
  'bash',
  'json',
  'latex',
];

export async function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const { createHighlighter } = await import('shiki/bundle/web');
      return createHighlighter({
        themes: ['github-dark', 'github-light'],
        langs: PRELOAD_LANGS,
      });
    })();
  }
  return highlighterPromise;
}

export interface HighlightResult {
  tokens: ThemedToken[][];
}

export async function highlightCode(
  code: string,
  lang: string,
  theme: 'github-dark' | 'github-light' = 'github-dark',
): Promise<HighlightResult> {
  const highlighter = await getHighlighter();
  const loaded = highlighter.getLoadedLanguages();
  const resolvedLang = loaded.includes(lang) ? lang : 'text';
  const { tokens } = highlighter.codeToTokens(code, { lang: resolvedLang, theme });
  return { tokens };
}
