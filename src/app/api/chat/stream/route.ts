/**
 * Chat Streaming API Route
 *
 * Uses ChatService with Strategy pattern for mode-specific behavior.
 * Streams responses via Server-Sent Events (SSE).
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { MODE_CONFIGS } from '@/constants/modes';
import { getChatService } from '@/lib/services/ChatService';
import { getQuotaService } from '@/lib/services/QuotaService';
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
  mode: z.enum(['Lecture Helper', 'Assignment Coach', 'Mock Exam']),
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
  const quotaService = getQuotaService();
  const quota = await quotaService.checkAndConsume(user.id);

  if (!quota.allowed) {
    return errorResponse(quota.error || 'Daily limit reached. Please upgrade your plan.', 429, {
      isLimitError: true,
    });
  }

  // 5. Get mode config for post-processing
  const modeConfig = MODE_CONFIGS[mode as keyof typeof MODE_CONFIGS];

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

          // Post-process with mode config if available
          if (modeConfig?.postprocessResponse) {
            const processed = modeConfig.postprocessResponse(fullResponse);
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

          let clientMessage = 'An unexpected error occurred. Please contact support.';
          const isLimitError = false;

          // Check if it's a Gemini API error (Third Party)
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Detect Gemini 429/Resource Exhausted
          if (
            errorMessage.includes('429') ||
            errorMessage.includes('RESOURCE_EXHAUSTED') ||
            errorMessage.includes('quota')
          ) {
            // It's a third-party capacity issue, not the user's plan limit
            clientMessage =
              'The AI service is currently experiencing high volume. Please try again in a moment.';
            // We do NOT set isLimitError=true here because that triggers the "Upgrade Plan" modal
            // which is reserved for when the USER hits their own limit.
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: clientMessage, isLimitError })}\n\n`),
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

    // Check if it's a rate limit error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRateLimit =
      errorMessage.includes('429') ||
      errorMessage.includes('RESOURCE_EXHAUSTED') ||
      errorMessage.includes('quota');

    if (isRateLimit) {
      // Third-party API limit (Gemini) - do NOT flag as user limit error
      return errorResponse(
        'The AI service is currently experiencing high volume. Please try again in a moment.',
        429,
        {
          isLimitError: false, // Explicitly false so UI doesn't show Upgrade modal
          isRetryable: true,
        },
      );
    }

    return errorResponse('An unexpected error occurred. Please try again.', 500, {
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
