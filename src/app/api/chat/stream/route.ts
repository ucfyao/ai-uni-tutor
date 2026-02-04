/**
 * Chat Streaming API Route
 *
 * Uses ChatService with Strategy pattern for mode-specific behavior.
 * Streams responses via Server-Sent Events (SSE).
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { checkAndConsumeQuota } from '@/app/actions/limits';
import { getChatService } from '@/lib/services/ChatService';
import { StrategyFactory } from '@/lib/strategies';
import { getCurrentUser } from '@/lib/supabase/server';
import type { ChatMessage, Course, TutoringMode } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const chatStreamSchema = z.object({
  course: z.object({
    id: z.string().optional(),
    universityId: z.string().optional(),
    code: z.string().min(1),
    name: z.string().min(1),
  }),
  mode: z.enum(['Lecture Helper', 'Assignment Coach', 'Exam Prep']),
  history: z.array(
    z.object({
      id: z.string().optional(),
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1),
      timestamp: z.number().optional(),
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

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  // 1. Parse request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const parsed = chatStreamSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse('Invalid request body', 400, parsed.error.flatten());
  }

  const { course, mode, history, userInput, images } = parsed.data;

  // 2. Validate API Key
  if (!process.env.GEMINI_API_KEY) {
    return errorResponse('Missing GEMINI_API_KEY', 500);
  }

  // 3. Authentication
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse('Unauthorized', 401);
  }

  // 4. Check Usage Limits
  const quota = await checkAndConsumeQuota();
  if (!quota.allowed) {
    return errorResponse(quota.error || 'Daily limit reached. Please upgrade your plan.', 429, {
      isLimitError: true,
    });
  }

  // 5. Get Strategy for the mode
  const strategy = StrategyFactory.create(mode as TutoringMode);

  // 6. Convert history to ChatMessage format
  const chatHistory: ChatMessage[] = history.map((msg, index) => ({
    id: msg.id || `msg-${index}`,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp || Date.now(),
    images: msg.images,
  }));

  // 7. Create streaming response using ChatService
  try {
    const chatService = getChatService();

    const streamGenerator = chatService.generateStream({
      course: course as Course,
      mode: mode as TutoringMode,
      history: chatHistory,
      userInput,
      images,
    });

    // Create SSE stream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = '';

          for await (const text of streamGenerator) {
            fullResponse += text;
            // Send as SSE data event
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }

          // Post-process with strategy if available
          if (strategy.postprocessResponse) {
            const processed = strategy.postprocessResponse(fullResponse);
            // If post-processing added content, send it
            if (processed.length > fullResponse.length) {
              const additional = processed.slice(fullResponse.length);
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: additional })}\n\n`),
              );
            }
          }

          // Send done event
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          const errorMsg = error instanceof Error ? error.message : 'Streaming failed';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`));
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

    // Check if it's a rate limit error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRateLimit =
      errorMessage.includes('429') ||
      errorMessage.includes('RESOURCE_EXHAUSTED') ||
      errorMessage.includes('quota');

    if (isRateLimit) {
      return errorResponse('API quota exceeded. Please wait a moment and try again.', 429, {
        isLimitError: true,
        isRetryable: true,
      });
    }

    return errorResponse('Failed to generate response. Please try again.', 500, {
      isRetryable: true,
    });
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function errorResponse(message: string, status: number, extra?: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
