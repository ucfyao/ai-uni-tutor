import { AppError } from '@/lib/errors';
import { extractFromPDF } from '@/lib/rag/pdf-extractor';
import { getAssignmentService } from '@/lib/services/AssignmentService';
import { getQuotaService } from '@/lib/services/QuotaService';
import { createSSEStream } from '@/lib/sse';
import { getCurrentUser } from '@/lib/supabase/server';
import type { AssignmentItemEntity } from '@/types/assignment';
import type { GradingResult } from '@/types/grading';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

// ============================================================================
// PROMPT BUILDER
// ============================================================================

function buildGradingPrompt(items: AssignmentItemEntity[]): string {
  const questionsBlock = items
    .map(
      (item) =>
        `Question ${item.orderNum}:\n` +
        `  Type: ${item.type}\n` +
        `  Content: ${item.content}\n` +
        `  Reference Answer: ${item.referenceAnswer}\n` +
        `  Max Points: ${item.points}`,
    )
    .join('\n\n');

  return `You are an expert academic grader. You will be given:
1. A set of assignment questions with reference answers and point values
2. A student's submitted file (PDF or image) containing their answers

Your task:
- Extract the student's answers from the uploaded file
- Match each answer to the corresponding question by question number
- Score each question from 0 to the maximum points (partial credit is allowed)
- Provide 2-3 sentences of specific feedback per question
- Generate an overall assessment and improvement suggestions
- If handwritten content is detected, include a format warning recommending LaTeX for future submissions

Return a JSON object with this exact structure:
{
  "responses": [
    {
      "questionIndex": <0-based index matching the question order>,
      "questionContent": "<the original question content>",
      "referenceAnswer": "<the reference answer>",
      "userAnswer": "<extracted student answer text, or 'No answer found' if missing>",
      "isCorrect": <true if full marks, false otherwise>,
      "score": <number from 0 to maxPoints>,
      "maxPoints": <maximum points for this question>,
      "feedback": "<2-3 sentences of specific feedback>"
    }
  ],
  "totalScore": <sum of all scores>,
  "maxScore": <sum of all maxPoints>,
  "summary": {
    "overallFeedback": "<2-3 sentence overall assessment>",
    "improvements": ["<specific improvement suggestion 1>", "<suggestion 2>", ...],
    "formatWarning": "<optional: warning about handwritten content, recommend LaTeX>"
  }
}

IMPORTANT:
- You MUST return one response entry for each question below, in the same order.
- If you cannot find an answer for a question, give it 0 points and note it in feedback.
- Be fair but rigorous in scoring. Award partial credit where the student shows understanding.
- The formatWarning field should only be present if handwritten content is detected.

Here are the assignment questions:

${questionsBlock}

Now examine the student's uploaded file and grade their answers.`;
}

// ============================================================================
// HELPERS
// ============================================================================

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(request: Request) {
  // 1. Authentication
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse('Unauthorized', 401);
  }

  // 2. Parse FormData
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse('Invalid form data', 400);
  }

  const assignmentId = formData.get('assignmentId');
  const file = formData.get('file');

  if (typeof assignmentId !== 'string' || !assignmentId) {
    return errorResponse('Missing assignmentId', 400);
  }

  if (!(file instanceof File)) {
    return errorResponse('Missing file', 400);
  }

  // 3. Validate file
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return errorResponse(
      `Unsupported file type: ${file.type}. Accepted: PDF, JPEG, PNG, WebP.`,
      400,
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return errorResponse(`File too large. Maximum size is 20 MB.`, 400);
  }

  // 4. Check quota
  const quota = await getQuotaService().checkAndConsume(user.id);
  if (!quota.allowed) {
    return errorResponse(quota.error || 'Daily limit reached. Please upgrade your plan.', 429);
  }

  // 5. Stream grading results via SSE
  const { stream, send, close } = createSSEStream();
  const signal = request.signal;

  const pipeline = (async () => {
    try {
      // 5a. Fetch assignment items (root-level only)
      send('grading_status', { stage: 'extracting', message: 'Loading assignment questions...' });
      send('log', { message: 'Loading assignment questions...', level: 'info' });

      const allItems = await getAssignmentService().getItems(assignmentId);
      const rootItems = allItems
        .filter((item) => !item.parentItemId)
        .sort((a, b) => a.orderNum - b.orderNum);

      if (rootItems.length === 0) {
        send('log', { message: 'No questions found for this assignment.', level: 'error' });
        send('error', { message: 'No questions found for this assignment.', code: 'VALIDATION' });
        return;
      }

      send('log', { message: `Found ${rootItems.length} questions to grade`, level: 'info' });

      // 5b. Read file buffer
      send('grading_status', {
        stage: 'extracting',
        message: 'Uploading student submission to AI...',
      });
      send('log', { message: 'Uploading submission to AI...', level: 'info' });

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 5c. Build prompt and call Gemini
      const prompt = buildGradingPrompt(rootItems);

      send('grading_status', { stage: 'grading', message: 'AI is grading your submission...' });
      send('log', { message: 'AI is analyzing your answers...', level: 'info' });

      const { result, warnings } = await extractFromPDF<GradingResult>(buffer, prompt, {
        signal,
        onProgress: (detail) => {
          send('grading_status', { stage: 'grading', message: detail });
        },
      });

      if (warnings.length > 0) {
        console.warn('[grading] Extraction warnings:', warnings);
        for (const w of warnings) {
          send('log', { message: w, level: 'warning' });
        }
      }

      // 5d. Send result
      send('grading_result', { result });
      send('log', {
        message: `Grading complete — scored ${result.totalScore}/${result.maxScore}`,
        level: 'success',
      });
      send('grading_status', { stage: 'complete', message: 'Grading complete' });
    } catch (error) {
      const appError = AppError.from(error);
      send('error', { message: appError.message, code: appError.code });
      send('grading_status', { stage: 'error', message: appError.message });
    } finally {
      close();
    }
  })();

  pipeline.catch(console.error);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
