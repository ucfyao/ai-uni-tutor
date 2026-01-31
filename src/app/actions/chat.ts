'use server';

import { GoogleGenAI } from "@google/genai";
import { ChatMessage, ChatSession, Course, TutoringMode } from "@/types/index";
import { createClient } from "@/lib/supabase/server";

// Initialize outside to allow env var loading check at runtime if needed, but here it's fine.
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MAX_RETRIES = 3;
const BASE_DELAY = 2000;

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Internal Implementation ---
async function _generateChatResponse(
    course: Course,
    mode: TutoringMode | null,
    history: ChatMessage[],
    userInput: string
) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("Missing GEMINI_API_KEY in environment variables");
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("Unauthorized");
    }

    // Check Usage Limits
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_RATELIMIT === 'true') {
        const { checkLLMUsage } = await import('@/lib/redis');

        // Get user subscription status
        const { data: profile } = await supabase
            .from('profiles')
            .select('subscription_status')
            .eq('id', user.id)
            .single();

        const isPro = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';

        const limit = isPro
            ? parseInt(process.env.LLM_LIMIT_DAILY_PRO || '100')
            : parseInt(process.env.LLM_LIMIT_DAILY_FREE || '10');

        const { success, count } = await checkLLMUsage(user.id, limit);

        console.log(`[Quota Check] User: ${user.id} | Plan: ${isPro ? 'Pro' : 'Free'} | Limit: ${limit} | Usage: ${count} | Success: ${success}`);

        if (!success) {
            throw new Error(`Daily limit reached (${limit}/${limit}). Please upgrade to Pro for more.`);
        }
    }

    // --- Validation Section ---
    if (!mode) {
        throw new Error("Validation Failed: Tutoring Mode must be selected before starting a chat.");
    }
    if (!course || !course.code) {
        throw new Error("Validation Failed: Invalid Course Context. Please restart the session.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 1. Prepare contents for Gemini
    const contents = history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    }));

    contents.push({
        role: 'user',
        parts: [{ text: userInput }]
    });

    // 2. Prepare System Instruction
    let systemInstruction = `
    You are an elite academic AI tutor for the course ${course.code}: ${course.name}.
    Mode: ${mode}.
    
    Instructions:
    1. Always use LaTeX for math formulas enclosed in $...$ or $$...$$. DO NOT wrap them in code blocks or backticks.
    2. In "Assignment Coach" mode:
       - Provide scaffolding and hints, never full answers.
       - For every key concept, syntax, or method mentioned, generate a Knowledge Card using the format: <card title='TERM'>Brief explanation</card>.
       - Place these cards at the end of the paragraph where the term is introduced.
    3. In "Lecture Helper" mode:
       - Be concise and emphasize logical connections.
       - You are a Tutor, not just an Answer Bot. Use guiding language (e.g., "Let's first look at...", "You can think of this as...").
       - For every key term, math concept, or proper noun mentioned, generate a Knowledge Card using the format: <card title='TERM'>Brief explanation</card>.
       - Place these cards at the end of the paragraph where the term is introduced.
       - Do not show the cards as a list in the main text; just embed the tags.
    4. Maintain a supportive, professor-like persona.
  `;

    // 3. RAG Integration
    try {
        const { retrieveContext } = await import('@/lib/rag/retrieval');
        // Filter by course code to implement commercial loop / contextual RAG
        const context = await retrieveContext(userInput, { course: course.code });

        if (context) {
            systemInstruction += `
            
            ### Context from User Documents:
            ${context}
            
            ### RAG Instructions:
            - Use the above context to answer the user's question if relevant.
            - If the information is present in the context, answer confidently based on it.
            - If the answer is NOT in the context, use your general knowledge but clarify that you are using general knowledge.
            - **IMPORTANT**: When referencing information from the context, cite the page number if available (e.g., "[Page 5]").
            `;
        }
    } catch (e) {
        console.error("RAG Retrieval Failed", e);
        // Continue without RAG
    }

    let lastError;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: contents,
                config: {
                    systemInstruction,
                    temperature: 0.7,
                }
            });

            return response.text;
        } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            lastError = error;
            // Check for 429 Too Many Requests
            if (error.message?.includes('429') || error.status === 429) {
                console.warn(`Gemini 429 Rate Limit hit. Retrying attempt ${attempt + 1}/${MAX_RETRIES}...`);
                await delay(BASE_DELAY * Math.pow(2, attempt)); // Exponential backoff: 2s, 4s, 8s
                continue;
            }
            // Other errors, break immediately
            break;
        }
    }

    console.error("Gemini service failed after retries:", lastError);
    throw lastError;
}

// --- Exported Wrapper with Error Masking ---
export type ChatActionResponse =
    | { success: true; data: string }
    | { success: false; error: string; isLimitError?: boolean };

export async function generateChatResponse(
    course: Course,
    mode: TutoringMode | null,
    history: ChatMessage[],
    userInput: string
): Promise<ChatActionResponse> {
    try {
        return { success: true, data: await _generateChatResponse(course, mode, history, userInput) };
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        // Business Logic Errors: Propagate message
        const message = error.message || String(error);

        // Specific handling for Limit Reached to trigger UI Modal
        if (message.includes("Daily limit reached")) {
            return { success: false, error: message, isLimitError: true };
        }

        if (
            message.includes("Validation Failed") ||
            message.includes("Unauthorized") ||
            message.includes("Missing GEMINI_API_KEY")
        ) {
            return { success: false, error: message };
        }

        // Technical/Third-Party Errors: Log and Mask
        console.error("Internal/Third-Party Error in generateChatResponse:", error);
        return { success: false, error: "An unexpected error occurred with the AI service. Please contact the administrator." };
    }
}

// --- Persistence Actions ---

export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: sessionData, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

    if (error || !sessionData) return null;

    const { data: msgData } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

    return {
        id: sessionData.id,
        course: sessionData.course,
        mode: sessionData.mode,
        title: sessionData.title,
        messages: msgData?.map((msg: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.created_at).getTime(),
            cardId: msg.card_id
        })) || [],
        lastUpdated: new Date(sessionData.updated_at).getTime(),
        isPinned: sessionData.is_pinned,
        isShared: sessionData.is_shared
    };
}

export async function getChatSessions(): Promise<ChatSession[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error fetching sessions:', error);
        return [];
    }


    // ... (previous code)

    const sessions: ChatSession[] = [];
    for (const row of data) {
        // Optimization: For the sidebar list, we might not need all messages immediately, 
        // but the type requires it. Fetching them ensures validity.
        const { data: msgData } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', row.id)
            .order('created_at', { ascending: true });

        sessions.push({
            id: row.id,
            course: row.course,
            mode: row.mode,
            title: row.title,
            messages: msgData?.map((msg: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                id: msg.id,
                role: msg.role,
                content: msg.content,
                timestamp: new Date(msg.created_at).getTime(),
                cardId: msg.card_id // Map DB column to type
            })) || [],
            lastUpdated: new Date(row.updated_at).getTime(),
            isPinned: row.is_pinned
        });
    }

    return sessions;
}

export async function createChatSession(session: Omit<ChatSession, 'id' | 'lastUpdated'>) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
            user_id: user.id,
            course: session.course,
            mode: session.mode,
            title: session.title,
            is_pinned: false
        })
        .select()
        .single();

    if (error) throw error;

    return {
        ...session,
        id: data.id,
        messages: [],
        lastUpdated: new Date(data.updated_at).getTime(),
        isPinned: false
    } as ChatSession;
}

export async function saveChatMessage(sessionId: string, message: ChatMessage) {
    const supabase = await createClient();
    const { error } = await supabase
        .from('chat_messages')
        .insert({
            session_id: sessionId,
            role: message.role,
            content: message.content,
            created_at: new Date(message.timestamp).toISOString(),
            card_id: message.cardId || null // Save cardId
        });

    if (error) throw error;

    await supabase
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);
}

export async function toggleSessionPin(sessionId: string, isPinned: boolean) {
    const supabase = await createClient();
    const { error } = await supabase
        .from('chat_sessions')
        .update({ is_pinned: isPinned })
        .eq('id', sessionId);

    if (error) throw error;
}

export async function deleteChatSession(sessionId: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId);

    if (error) throw error;
}

export async function updateChatSessionTitle(sessionId: string, title: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from('chat_sessions')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', sessionId);

    if (error) throw error;
}

export async function updateChatSessionMode(sessionId: string, mode: TutoringMode) {
    const supabase = await createClient();
    const { error } = await supabase
        .from('chat_sessions')
        .update({ mode, updated_at: new Date().toISOString() })
        .eq('id', sessionId);

    if (error) throw error;
}

export async function toggleSessionShare(sessionId: string, isShared: boolean) {
    const supabase = await createClient();

    // Default expiration: 1 hour from now
    const expiresAt = isShared ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null;

    const { error } = await supabase
        .from('chat_sessions')
        .update({
            is_shared: isShared,
            share_expires_at: expiresAt
        })
        .eq('id', sessionId);

    if (error) throw error;
}

export async function getSharedSession(sessionId: string): Promise<ChatSession | null> {
    const supabase = await createClient();

    // Fetch session only if it is marked as shared
    const { data: sessionData, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('is_shared', true)
        .or(`share_expires_at.is.null,share_expires_at.gt.${new Date().toISOString()}`) // Check expiration
        .single();

    if (error || !sessionData) {
        return null; // Not found or not shared
    }

    // Fetch messages for the session
    const { data: msgData } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

    return {
        id: sessionData.id,
        course: sessionData.course,
        mode: sessionData.mode,
        title: sessionData.title,
        messages: msgData?.map((msg: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.created_at).getTime(),
            cardId: msg.card_id // Map DB column
        })) || [],
        lastUpdated: new Date(sessionData.updated_at).getTime(),
        isPinned: sessionData.is_pinned,
        isShared: sessionData.is_shared
    };
}
