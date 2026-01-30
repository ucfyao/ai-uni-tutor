
export interface KnowledgeCard {
    id: string;
    title: string;
    content: string;
}

export const extractCards = (text: string): { cleanContent: string; cards: KnowledgeCard[] } => {
    const cards: KnowledgeCard[] = [];
    const cardRegex = /<card\s+([^>]*?)>([\s\S]*?)<\/card>/gi;

    let cleanContent = text.replace(cardRegex, (match, attributes, content) => {
        const titleMatch = attributes.match(/title=['"]([^'"]+)['"]/);
        const title = titleMatch ? titleMatch[1] : 'Untitled Concept';
        // Add to cards array
        cards.push({
            id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `card-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            title: title.trim(),
            content: content.trim()
        });
        // Remove from main text
        return '';
    });

    return { cleanContent, cards };
};

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function injectLinks(content: string, cards: KnowledgeCard[]): string {
    // Pre-clean: Remove backticks around math blocks which break rendering
    // e.g. `$\theta$` -> $\theta$
    content = content
        .replace(/`(\$\$[\s\S]*?\$\$)`/g, '$1')
        .replace(/`(\$[^`\n]+?\$)`/g, '$1');

    if (!cards.length) return content;

    const sortedCards = [...cards].sort((a, b) => b.title.length - a.title.length);

    // Regex to match code blocks, inline code, and math to PROTECT them
    const protectedPattern = /(```[\s\S]*?```|`[^`]*`|\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g;

    const parts = content.split(protectedPattern);

    let result = '';

    for (let i = 0; i < parts.length; i++) {
        let part = parts[i];

        // Even indices are text outside protected blocks
        if (i % 2 === 0 && part) {
            sortedCards.forEach(card => {
                // Avoid replacing inside existing markdown links [text](url)
                // Lookahead checks we are not inside []

                const hasCJK = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(card.title);

                // Regex patterns for matching
                const mdMarker = "(?:\\*\\*|__)";
                const escapedTitle = escapeRegExp(card.title);

                let regex;

                if (hasCJK) {
                    // For CJK: Match either strictly wrapped (**Title**) OR plain (Title)
                    // We avoid matching partials like **Title 
                    regex = new RegExp(`(${mdMarker}${escapedTitle}${mdMarker}|${escapedTitle})(?![^\\[]*\\])`, 'gi');
                } else {
                    // For English: 
                    // 1. Wrapped **Title** (Note: * is non-word, so \b check inside ** isn't needed usually, but markers are safer)
                    // 2. Plain \bTitle\b
                    regex = new RegExp(`(${mdMarker}${escapedTitle}${mdMarker}|\\b${escapedTitle}\\b)(?![^\\[]*\\])`, 'gi');
                }

                part = part.replace(regex, `[$1](#card-${card.id})`);
            });
            result += part;
        } else if (part) {
            // Odd indices are protected blocks (or empty strings if undefined)
            result += part;
        }
    }

    return result;
}
