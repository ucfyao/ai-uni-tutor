import { createHighlighterCore, type HighlighterCore, type ThemedToken } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

let highlighterPromise: Promise<HighlighterCore> | null = null;

export async function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      engine: createJavaScriptRegexEngine(),
      themes: [import('shiki/themes/github-dark.mjs'), import('shiki/themes/github-light.mjs')],
      langs: [
        import('shiki/langs/python.mjs'),
        import('shiki/langs/javascript.mjs'),
        import('shiki/langs/typescript.mjs'),
        import('shiki/langs/java.mjs'),
        import('shiki/langs/c.mjs'),
        import('shiki/langs/cpp.mjs'),
        import('shiki/langs/sql.mjs'),
        import('shiki/langs/r.mjs'),
        import('shiki/langs/matlab.mjs'),
        import('shiki/langs/html.mjs'),
        import('shiki/langs/css.mjs'),
        import('shiki/langs/bash.mjs'),
        import('shiki/langs/json.mjs'),
        import('shiki/langs/latex.mjs'),
      ],
    });
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
