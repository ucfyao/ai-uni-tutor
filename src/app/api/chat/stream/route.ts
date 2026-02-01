import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    // 1. Parse request body
    const { course, mode, history, userInput } = await req.json();

    // 2. Validate API Key
    if (!process.env.GEMINI_API_KEY) {
        return new Response(
            JSON.stringify({ error: "Missing GEMINI_API_KEY" }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // 3. Authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // 4. Check Usage Limits
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_RATELIMIT === 'true') {
        const { checkLLMUsage } = await import('@/lib/redis');

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
            return new Response(
                JSON.stringify({ error: `Daily limit reached (${limit}/${limit})`, isLimitError: true }),
                { status: 429, headers: { 'Content-Type': 'application/json' } }
            );
        }
    }

    // 5. Validation
    if (!mode) {
        return new Response(
            JSON.stringify({ error: "Validation Failed: Tutoring Mode must be selected" }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }
    if (!course || !course.code) {
        return new Response(
            JSON.stringify({ error: "Validation Failed: Invalid Course Context" }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // 6. Prepare AI Request
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const contents = history.map((msg: { role: string; content: string }) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    }));

    contents.push({
        role: 'user',
        parts: [{ text: userInput }]
    });

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

    // 7. RAG Integration
    try {
        const { retrieveContext } = await import('@/lib/rag/retrieval');
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
    }

    // 8. Create streaming response
    try {
        const stream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                systemInstruction,
                temperature: 0.7,
            }
        });

        // Create a TransformStream to convert the Gemini stream to SSE format
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of stream) {
                        const text = chunk.text;
                        if (text) {
                            // Send as SSE data event
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                        }
                    }
                    // Send done event
                    controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                    controller.close();
                } catch (error) {
                    console.error("Streaming error:", error);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Streaming failed" })}\n\n`));
                    controller.close();
                }
            }
        });

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (error) {
        console.error("Failed to start stream:", error);
        return new Response(
            JSON.stringify({ error: "Failed to generate response" }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
