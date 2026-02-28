/**
 * Writing Analysis API Route
 *
 * Accepts content + selected services, runs WritingAssistantService,
 * and streams results back as SSE events (one per service).
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { getQuotaService } from '@/lib/services/QuotaService';
import { getWritingAssistantService } from '@/lib/services/WritingAssistantService';
import { createSSEStream } from '@/lib/sse';
import { getCurrentUser } from '@/lib/supabase/server';
import type { WritingAnalysisRequest, WritingService } from '@/types/writing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const analyzeSchema = z.object({
  content: z.string().min(1, 'Content must not be empty'),
  services: z
    .array(z.enum(['format', 'polish', 'originality', 'structure']))
    .min(1, 'At least one service must be selected'),
  citationStyle: z.enum(['apa', 'mla', 'chicago', 'harvard']).optional(),
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

  const parsed = analyzeSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse('Invalid request body', 400, parsed.error.flatten());
  }

  const { content, services, citationStyle } = parsed.data;

  // 2. Authentication
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse('Unauthorized', 401);
  }

  // 3. Check quota
  const quotaService = getQuotaService();
  const quota = await quotaService.checkAndConsume(user.id);

  if (!quota.allowed) {
    return errorResponse(quota.error || 'Daily limit reached. Please upgrade your plan.', 429, {
      isLimitError: true,
    });
  }

  // 4. Stream results via SSE
  const { stream, send, close } = createSSEStream();

  // Run analysis in background, streaming each service result as it completes
  runAnalysis(content, services, citationStyle, send, close);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// ============================================================================
// BACKGROUND ANALYSIS
// ============================================================================

async function runAnalysis(
  content: string,
  services: WritingService[],
  citationStyle: WritingAnalysisRequest['citationStyle'],
  send: ReturnType<typeof createSSEStream>['send'],
  close: ReturnType<typeof createSSEStream>['close'],
) {
  const writingService = getWritingAssistantService();

  try {
    const results = await writingService.analyze({ content, services, citationStyle });

    for (const result of results) {
      send('writing_result', {
        service: result.service,
        suggestions: result.suggestions,
        overallScore: result.overallScore,
      });
    }
  } catch (error) {
    console.error('[writing/analyze] Analysis failed:', error);

    const appErr = error instanceof AppError ? error : AppError.from(error);
    send('writing_result', {
      service: services[0],
      suggestions: [],
      error: appErr.message,
    });
  } finally {
    close();
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
