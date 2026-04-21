import 'server-only';
import { z } from 'zod';
import { extractFromPDF } from '@/lib/rag/pdf-extractor';

const answerItemSchema = z.object({
  title: z.string().min(1),
  orderNum: z.number().optional(),
  referenceAnswer: z.string().min(1),
  explanation: z.string().optional().default(''),
});

const extractionSchema = z.object({
  answers: z.array(answerItemSchema).min(1),
});

export type ExtractedAnswer = z.infer<typeof answerItemSchema>;

export interface AnswerExtractionResult {
  answers: ExtractedAnswer[];
  warnings: string[];
}

function buildPrompt(): string {
  return `You are an expert academic answer key analyzer.

Analyze this PDF document and extract ONLY the answers/solutions. This document is an answer key, solution manual, or marking guide.

For each answer found, extract:
- title: The question number or label exactly as shown (e.g. "Question 1", "Q1", "1(a)", "Part A"). This MUST match the original question numbering.
- orderNum: Sequential number (1, 2, 3...) based on the order answers appear
- referenceAnswer: The complete reference answer or solution in Markdown (use KaTeX for math: $...$ inline, $$...$$ block)
- explanation: Step-by-step solution explanation if present (empty string if none)

Critical rules:
- Extract EVERY answer — do not skip any
- The "title" field is crucial for matching answers to questions — use the exact question label/number from the document
- If an answer has sub-parts (a), (b), (c), extract each sub-part as a separate entry with its full label (e.g. "1(a)", "1(b)")
- If the document contains both questions and answers, extract ONLY the answers

## Math & Formatting Rules (MANDATORY for referenceAnswer, explanation)

1. EVERY math expression — no matter how small — MUST be wrapped in dollar signs:
   - Inline math: $x^2$, $P_{ik}$, $\\frac{1}{2}$
   - Display/block math: $$\\frac{\\partial J}{\\partial w_c} = -\\sum_{i=1}^{n} (P_{ic} - Y_{ic}) x_i$$
2. NEVER leave bare LaTeX commands like \\frac, \\sum, \\partial outside of $...$ delimiters.
3. Use $$...$$ (display math) for important equations, derivation steps, final results.
4. Separate derivation steps with blank lines (\\n\\n) between them for readability.
5. For multi-step proofs/derivations, structure as: Step description\\n\\n$$formula$$\\n\\nNext step\\n\\n$$formula$$

Return ONLY a valid JSON object. Expected format:
{"answers": [{"title": "Q1", "orderNum": 1, "referenceAnswer": "The answer...", "explanation": "Step 1: ..."}]}
No markdown, no explanation.
- IMPORTANT: Inside JSON strings, backslashes MUST be escaped as \\\\. For example, LaTeX "\\alpha" must be written as "\\\\alpha" in JSON.`;
}

export async function extractAnswersFromPDF(
  fileBuffer: Buffer,
  signal?: AbortSignal,
  onProgress?: (detail: string) => void,
): Promise<AnswerExtractionResult> {
  if (signal?.aborted) return { answers: [], warnings: [] };

  const prompt = buildPrompt();

  const { result: raw, warnings: extractWarnings } = await extractFromPDF<unknown>(
    fileBuffer,
    prompt,
    {
      signal,
      onProgress,
      callType: 'parse-exam',
      responseSchema: {
        type: 'object',
        properties: {
          answers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                orderNum: { type: 'integer' },
                referenceAnswer: { type: 'string' },
                explanation: { type: 'string' },
              },
              required: ['title', 'referenceAnswer'],
            },
          },
        },
        required: ['answers'],
      },
    },
  );

  if (extractWarnings.length > 0) {
    return { answers: [], warnings: extractWarnings };
  }

  // Normalize: Gemini may return bare array
  const normalized = Array.isArray(raw) ? { answers: raw } : raw;

  const result = extractionSchema.safeParse(normalized);
  if (result.success) {
    return { answers: result.data.answers, warnings: [] };
  }

  // Partial recovery
  const warnings: string[] = [];
  const issues = result.error.issues;
  warnings.push(
    `Schema validation: ${issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
  );

  const rawObj = normalized as Record<string, unknown>;
  const rawAnswers = Array.isArray(rawObj?.answers) ? rawObj.answers : [];

  const validAnswers: ExtractedAnswer[] = [];
  for (const item of rawAnswers) {
    const single = answerItemSchema.safeParse(item);
    if (single.success) validAnswers.push(single.data);
  }

  if (validAnswers.length > 0) {
    warnings.push(`Recovered ${validAnswers.length}/${rawAnswers.length} valid answers`);
  }

  return { answers: validAnswers, warnings };
}
