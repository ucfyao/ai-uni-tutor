/**
 * Chat Streaming API Route
 *
 * Uses ChatService with Strategy pattern for mode-specific behavior.
 * Streams responses via Server-Sent Events (SSE).
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { MODE_CONFIGS } from '@/constants/modes';
import { AppError } from '@/lib/errors';
import { getRedis } from '@/lib/redis';
import { getChatService } from '@/lib/services/ChatService';
import { getQuotaService } from '@/lib/services/QuotaService';
import { getCurrentUser } from '@/lib/supabase/server';
import type { ChatMessage, Course, TutoringMode } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Strip API keys from error messages before logging. */
export function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.stack || error.message : String(error);
  return raw
    .replace(/[?&]key=[^\s&"')]+/gi, '?key=[REDACTED]')
    .replace(new RegExp(process.env.GEMINI_API_KEY || '$^', 'g'), '[REDACTED]');
}

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
  requestId: z.string().uuid().optional(),
  resumeFrom: z.number().int().min(0).optional(),
  images: z
    .array(
      z.object({
        data: z.string(),
        mimeType: z.string(),
      }),
    )
    .optional(),
  document: z
    .object({
      data: z.string(),
      mimeType: z.string(),
    })
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

  const { course, mode, history, userInput, requestId, resumeFrom, images, document } = parsed.data;

  // 2. Validate AI chat config availability
  const hasAiChat = Object.entries(process.env).some(([k, v]) => /^AI_CHAT_\d+$/.test(k) && !!v);
  if (!hasAiChat && !process.env.GEMINI_API_KEY) {
    return errorResponse('Missing AI chat configuration (AI_CHAT_* or GEMINI_API_KEY)', 500);
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
    const isReconnect = resumeFrom !== undefined && !!requestId;
    const sessionId = user.id;
    const cacheConfig = isReconnect ? { requestId: requestId!, sessionId } : undefined;

    // Capture sources from RAG retrieval via callback
    let ragSources: import('@/types').ChatSource[] = [];
    const streamGenerator = chatService.generateStream(
      {
        course: course as Course,
        mode: mode as TutoringMode,
        history: chatHistory,
        userInput,
        images,
        document,
        onSources: (sources) => {
          ragSources = sources;
        },
      },
      cacheConfig,
    );

    // Create SSE stream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = '';
          let sourcesSent = false;

          // If reconnecting, replay cached chunks first
          if (isReconnect) {
            const redis = getRedis();
            const key = `stream:${sessionId}:${requestId}`;
            const cached = await redis.lrange(key, resumeFrom!, -1);
            for (const chunk of cached) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
            }
          }

          for await (const text of streamGenerator) {
            // Send sources on first chunk (RAG completes before first yield)
            if (!sourcesSent && ragSources.length > 0) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ sources: ragSources })}\n\n`),
              );
              sourcesSent = true;
            }
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
          console.error('Streaming error:', sanitizeError(error));

          const appErr = AppError.from(error);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: appErr.message, isLimitError: false, code: appErr.code })}\n\n`,
            ),
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
    console.error('Failed to start stream:', sanitizeError(error));

    const appErr = AppError.from(error);
    const retryable = [
      'GEMINI_RATE_LIMITED',
      'GEMINI_QUOTA_EXCEEDED',
      'GEMINI_UNAVAILABLE',
    ].includes(appErr.code);

    return errorResponse(appErr.message, retryable ? 429 : 500, {
      isLimitError: false,
      isRetryable: retryable,
      code: appErr.code,
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
