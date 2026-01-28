import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "./embedding";

export async function retrieveContext(query: string, filter: Record<string, any> = {}, matchCount: number = 5) {
    const embedding = await generateEmbedding(query);
    const supabase = await createClient();

    // Hybrid Search: combines vector similarity + keyword rank (RRF)
    const { data: chunks, error } = await supabase.rpc('hybrid_search', {
        query_text: query,
        query_embedding: embedding as any,
        match_threshold: 0.5,
        match_count: matchCount,
        rrf_k: 60,
        filter: filter,
    });

    if (error) {
        console.error('Error retrieving context:', error);
        return "";
    }

    // Format context with citations
    // e.g. "Content... (Page 5)"
    return chunks.map(chunk => {
        const page = (chunk.metadata as any)?.page;
        const sourceInfo = page ? ` (Page ${page})` : '';
        return `${chunk.content}${sourceInfo}`;
    }).join('\n\n---\n\n');
}
