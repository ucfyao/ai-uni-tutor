export interface KnowledgeCard {
  id: string;
  title: string;
  content: string;
}

// Shared helper to create a normalized card id and push to list
const createCard = (title: string, content: string, cards: KnowledgeCard[]): KnowledgeCard => {
  const preExistingCardLinkPattern = /\[([^\]]+)\]\(#card-([^)]+)\)/g;
  const preExistingMatches = content.match(preExistingCardLinkPattern);
  if (preExistingMatches && preExistingMatches.length > 0) {
    content = content.replace(preExistingCardLinkPattern, (_match, linkText) => linkText);
  }

  const id =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `card-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  const card: KnowledgeCard = {
    id,
    title,
    content: content.trim(),
  };

  cards.push(card);
  return card;
};

export const extractCards = (text: string): { cleanContent: string; cards: KnowledgeCard[] } => {
  const cards: KnowledgeCard[] = [];

  // Existing regex for <card> tags
  const xmlCardRegex = /<card\s+([^>]*?)>([\s\S]*?)<\/card>/gi;
  // New regex for :::card directives
  // Matches optional preceding newline to merge with previous text
  // Allows optional space before {
  const directiveCardRegex = /(?:[\r\n]+\s*)?:::card\s*\{([^}]*?)\}\s*([\s\S]*?)\s*:::/gi;

  // Helper to process title and card creation for inline XML-style cards
  const processCard = (title: string, content: string, matchedNewline: boolean) => {
    const { id } = createCard(title, content, cards);
    // Add a leading space if we consumed a newline to ensure separation
    return `${matchedNewline ? ' ' : ''}[${title}](#card-${id})`;
  };

  // First pass: Handle XML-style cards <card title="...">...</card>
  let cleanContent = text.replace(xmlCardRegex, (match, attributes, content) => {
    const titleMatch = attributes.match(/title=['"]([^'"]+)['"]/);
    const title = (titleMatch ? titleMatch[1] : 'Untitled Concept').trim();
    return processCard(title, content, false);
  });

  // Second pass: Handle directive-style cards :::card{title="..."} ... :::
  cleanContent = cleanContent.replace(directiveCardRegex, (match, attributes, content) => {
    // Check if the match started with a newline (i.e., we consumed a newline/block start)
    const consumedNewline = /^\s*[\r\n]/.test(match);

    const titleMatch = attributes.match(/title=['"]([^'"]+)['"]/);
    const title = (titleMatch ? titleMatch[1] : 'Untitled Concept').trim();

    // Create the knowledge card for this directive so that injectLinks
    // can later turn occurrences of the title in the text into links.
    createCard(title, content, cards);

    // For directive-style cards, we ONLY create the side card and
    // do NOT inject an inline markdown link here. Inline links will
    // be added later by injectLinks when the same title appears in text.
    // Preserve paragraph spacing if we consumed a leading newline,
    // but keep the plain title in the main text so that important
    // concepts are still visible even if automatic linking is disabled.
    const prefix = consumedNewline ? '\n\n' : '';
    return `${prefix}${title}`;
  });

  // Third pass: Normalize any existing explicit card markdown links
  // like [Title](#card-some-id) that may have been produced directly
  // by the model. We strip the markdown wrapper but keep the text so
  // that downstream rendering (even when knowledge cards are disabled)
  // shows clean titles without raw [ ](...) noise. When knowledge
  // cards are enabled, injectLinks will re-create consistent links.
  const preExistingCardLinkPattern = /\[([^\]]+)\]\(#card-([^)]+)\)/g;
  const preExistingMatches = cleanContent.match(preExistingCardLinkPattern);
  if (preExistingMatches && preExistingMatches.length > 0) {
    cleanContent = cleanContent.replace(preExistingCardLinkPattern, (_match, linkText) => linkText);
  }

  return { cleanContent, cards };
};

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function injectLinks(content: string, cards: KnowledgeCard[]): string {
  // Pre-clean: Remove backticks around math blocks which break rendering
  // e.g. `$\theta$` -> $\theta$
  content = content.replace(/`(\$\$[\s\S]*?\$\$)`/g, '$1').replace(/`(\$[^`\n]+?\$)`/g, '$1');

  // Normalize: Some model outputs may already contain explicit card links like
  // [Title](#card-some-id). These often render poorly (showing raw brackets)
  // and also bypass our consistent linking rules. Here we strip the markdown
  // link but keep the visible text; injectLinks will then re-link based on
  // the canonical card.id.
  const preExistingCardLinkPattern = /\[([^\]]+)\]\(#card-([^)]+)\)/g;
  const preExistingMatches = content.match(preExistingCardLinkPattern);
  if (preExistingMatches && preExistingMatches.length > 0) {
    content = content.replace(preExistingCardLinkPattern, (_match, linkText) => linkText);
  }

  if (!cards.length) return content;

  const sortedCards = [...cards].sort((a, b) => b.title.length - a.title.length);

  // Regex to match code blocks, inline code, math, AND existing markdown links to PROTECT them
  const protectedPattern =
    /(```[\s\S]*?```|`[^`]*`|\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\[[^\]]*\]\([^)]*\))/g;

  const parts = content.split(protectedPattern);

  let result = '';

  for (let i = 0; i < parts.length; i++) {
    let part = parts[i];

    // Even indices are text outside protected blocks
    if (i % 2 === 0 && part) {
      sortedCards.forEach((card) => {
        const hasCJK =
          /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(
            card.title,
          );

        // Regex patterns for matching
        const mdMarker = '(?:\\*\\*|__)';
        const escapedTitle = escapeRegExp(card.title);

        let regex;

        if (hasCJK) {
          // For CJK: Match either strictly wrapped (**Title**) OR plain (Title)
          regex = new RegExp(`${mdMarker}${escapedTitle}${mdMarker}|${escapedTitle}`, 'gi');
        } else {
          // For English:
          // 1. Wrapped **Title**
          // 2. Plain \bTitle\b
          regex = new RegExp(`${mdMarker}${escapedTitle}${mdMarker}|\\b${escapedTitle}\\b`, 'gi');
        }

        part = part.replace(regex, `[$&](#card-${card.id})`);
      });
      result += part;
    } else if (part) {
      // Odd indices are protected blocks (or empty strings if undefined)
      result += part;
    }
  }

  return result;
}
