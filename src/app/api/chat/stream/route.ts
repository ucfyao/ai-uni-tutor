import { NextRequest } from 'next/server';
import { z } from 'zod';
import { checkAndConsumeQuota } from '@/app/actions/limits';
import { checkApiRateLimit } from '@/lib/api-rate-limit';
import { getGenAI } from '@/lib/gemini';
import { appendRagContext, buildSystemInstruction } from '@/lib/prompts';
import { getCurrentUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const chatStreamSchema = z.object({
  course: z.object({
    code: z.string().min(1),
    name: z.string().min(1),
  }),
  mode: z.string().min(1),
  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1),
      images: z
        .array(
          z.object({
            data: z.string(),
            mimeType: z.string(),
          }),
        )
        .optional(),
    }),
  ),
  userInput: z.string().min(1),
  images: z
    .array(
      z.object({
        data: z.string(),
        mimeType: z.string(),
      }),
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  // 0. Rate limit
  const rateLimitRes = await checkApiRateLimit(req);
  if (rateLimitRes) return rateLimitRes;

  // 1. Parse request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = chatStreamSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid request body', details: parsed.error.flatten() }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { course, mode, history, userInput, images } = parsed.data;

  // 2. Validate API Key
  if (!process.env.GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'Missing GEMINI_API_KEY' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. Authentication
  const user = await getCurrentUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 4. Check Usage Limits (Unified)
  const quota = await checkAndConsumeQuota();

  if (!quota.allowed) {
    return new Response(
      JSON.stringify({
        error: quota.error || 'Daily limit reached. Please upgrade your plan.',
        isLimitError: true,
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // 5. Prepare AI Request
  const ai = getGenAI();

  const contents = history.map((msg: (typeof history)[0]) => {
    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
      { text: msg.content },
    ];

    // Add images if present
    if (msg.images && msg.images.length > 0) {
      msg.images.forEach((img) => {
        parts.push({
          inlineData: {
            data: img.data,
            mimeType: img.mimeType,
          },
        });
      });
    }

    return {
      role: msg.role === 'user' ? 'user' : 'model',
      parts,
    };
  });

  // Add current user message with images
  const userParts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
    { text: userInput },
  ];

  if (images && images.length > 0) {
    images.forEach((img) => {
      userParts.push({
        inlineData: {
          data: img.data,
          mimeType: img.mimeType,
        },
      });
    });
  }

  contents.push({
    role: 'user',
    parts: userParts,
  });

  let systemInstruction = buildSystemInstruction(course, mode);

  // 7. RAG Integration
  try {
    const { retrieveContext } = await import('@/lib/rag/retrieval');
    const context = await retrieveContext(userInput, { course: course.code });

    if (context) {
      systemInstruction = appendRagContext(systemInstruction, context);
    }
  } catch (e) {
    console.error('RAG Retrieval Failed', e);
  }

  // 8. Create streaming response
  try {
    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
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
          console.error('Streaming error:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`),
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Failed to start stream:', error);

    // Check if it's a rate limit error from Gemini API
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isGeminiRateLimit =
      errorMessage.includes('429') ||
      errorMessage.includes('RESOURCE_EXHAUSTED') ||
      errorMessage.includes('quota');

    if (isGeminiRateLimit) {
      return new Response(
        JSON.stringify({
          error: 'API quota exceeded. Please wait a moment and try again.',
          isLimitError: true,
          isRetryable: true,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to generate response. Please try again.',
        isRetryable: true,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
