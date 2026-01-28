
export interface KnowledgeCard {
    id: string;
    title: string;
    content: string;
}

export const extractCards = (text: string): { cleanContent: string; cards: KnowledgeCard[] } => {
    const cards: KnowledgeCard[] = [];
    const cardRegex = /<card\s+([^>]*?)>([\s\S]*?)<\/card>/g;

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
