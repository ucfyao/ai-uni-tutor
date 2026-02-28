/**
 * Writing Assistant Service
 *
 * Runs writing-analysis prompts (format, polish, originality, structure)
 * against Gemini and returns typed WritingSuggestion arrays.
 */

import type { GoogleGenAI } from '@google/genai';
import { AppError } from '@/lib/errors';
import type { PoolEntry } from '@/lib/gemini';
import { getChatPool } from '@/lib/gemini';
import type {
  WritingAnalysisRequest,
  WritingAnalysisResult,
  WritingService,
  WritingSuggestion,
} from '@/types/writing';

// ── Prompt builders (one per service) ────────────────────────────────────────

const SHARED_RULES = `Return ONLY a JSON array of suggestion objects. No markdown, no code fences, no explanation outside the array.
Each object must have these fields:
- id (string, unique per suggestion, e.g. "fmt-1")
- service (string, the service name)
- severity ("error" | "warning" | "suggestion" | "info")
- paragraphIndex (number, 0-based paragraph index)
- startOffset (number | null, character offset within the paragraph)
- endOffset (number | null)
- originalText (string | null, the text being targeted)
- suggestedText (string | null, replacement text)
- explanation (string, human-readable reason)`;

function buildFormatPrompt(content: string, citationStyle?: string): string {
  return `You are a strict academic formatting reviewer.
Analyze the following text for formatting issues: citation style${citationStyle ? ` (${citationStyle.toUpperCase()})` : ''}, heading hierarchy, list consistency, paragraph spacing, and whitespace.

${SHARED_RULES}
- Also include: riskScore: null, structureType: null
- Set service to "format"

TEXT:
${content}`;
}

function buildPolishPrompt(content: string): string {
  return `You are an expert academic writing editor.
Analyze the following text for grammar, spelling, punctuation, word choice, sentence clarity, conciseness, and academic tone.

${SHARED_RULES}
- Also include: riskScore: null, structureType: null
- Set service to "polish"

TEXT:
${content}`;
}

function buildOriginalityPrompt(content: string): string {
  return `You are an originality and plagiarism-risk analyst.
Analyze the following text for potential originality concerns: overly generic phrasing, unattributed claims, patchwriting, and cliché academic filler.
Assign each suggestion a riskScore (0-100) indicating how likely the passage is to be flagged.

${SHARED_RULES}
- Also include: riskScore (number 0-100), structureType: null
- Set service to "originality"

TEXT:
${content}`;
}

function buildStructurePrompt(content: string): string {
  return `You are an academic essay structure analyst.
Analyze the following text for structural issues: missing topic sentences, weak transitions between paragraphs, unsupported claims lacking evidence, and overall argument flow.

${SHARED_RULES}
- Also include: riskScore: null, structureType ("topic_sentence" | "transition" | "evidence" | "overall")
- Set service to "structure"

TEXT:
${content}`;
}

const PROMPT_BUILDERS: Record<WritingService, (content: string, citationStyle?: string) => string> =
  {
    format: buildFormatPrompt,
    polish: buildPolishPrompt,
    originality: buildOriginalityPrompt,
    structure: buildStructurePrompt,
  };

// ── Service class ────────────────────────────────────────────────────────────

export class WritingAssistantService {
  /**
   * Run one or more writing-analysis services in parallel.
   */
  async analyze(request: WritingAnalysisRequest): Promise<WritingAnalysisResult[]> {
    if (!request.content.trim()) {
      throw new AppError('VALIDATION', 'Content must not be empty');
    }
    if (request.services.length === 0) {
      throw new AppError('VALIDATION', 'At least one service must be selected');
    }

    const results = await Promise.all(
      request.services.map((service) => this.runService(service, request)),
    );

    return results;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async runService(
    service: WritingService,
    request: WritingAnalysisRequest,
  ): Promise<WritingAnalysisResult> {
    const prompt = PROMPT_BUILDERS[service](request.content, request.citationStyle);

    const raw = await getChatPool().withRetry((entry) => this.callGemini(entry, prompt), {
      callType: 'writing',
    });

    const suggestions = this.parseResponse(raw, service);

    const result: WritingAnalysisResult = { service, suggestions };

    if (service === 'originality' && suggestions.length > 0) {
      const scores = suggestions.filter((s) => s.riskScore != null).map((s) => s.riskScore!);
      result.overallScore =
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : undefined;
    }

    return result;
  }

  private async callGemini(entry: PoolEntry, prompt: string): Promise<string> {
    if (entry.provider !== 'gemini') {
      throw new AppError('VALIDATION', 'Writing analysis requires a Gemini provider');
    }

    const response = await (entry.client as GoogleGenAI).models.generateContent({
      model: entry.model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    return response.text ?? '';
  }

  /** Parse the raw JSON string from Gemini into typed suggestions. */
  private parseResponse(raw: string, service: WritingService): WritingSuggestion[] {
    if (!raw.trim()) return [];

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed.map(
        (item: Record<string, unknown>, i: number): WritingSuggestion => ({
          id: typeof item.id === 'string' ? item.id : `${service}-${i}`,
          service,
          severity: validateSeverity(item.severity),
          paragraphIndex: typeof item.paragraphIndex === 'number' ? item.paragraphIndex : 0,
          startOffset: typeof item.startOffset === 'number' ? item.startOffset : undefined,
          endOffset: typeof item.endOffset === 'number' ? item.endOffset : undefined,
          originalText: typeof item.originalText === 'string' ? item.originalText : undefined,
          suggestedText: typeof item.suggestedText === 'string' ? item.suggestedText : undefined,
          explanation: typeof item.explanation === 'string' ? item.explanation : '',
          riskScore: typeof item.riskScore === 'number' ? item.riskScore : undefined,
          structureType: validateStructureType(item.structureType),
        }),
      );
    } catch {
      console.error(
        '[WritingAssistantService] Failed to parse Gemini response:',
        raw.slice(0, 200),
      );
      return [];
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_SEVERITIES = new Set(['error', 'warning', 'suggestion', 'info']);
function validateSeverity(value: unknown): WritingSuggestion['severity'] {
  return typeof value === 'string' && VALID_SEVERITIES.has(value)
    ? (value as WritingSuggestion['severity'])
    : 'suggestion';
}

const VALID_STRUCTURE_TYPES = new Set(['topic_sentence', 'transition', 'evidence', 'overall']);
function validateStructureType(value: unknown): WritingSuggestion['structureType'] {
  return typeof value === 'string' && VALID_STRUCTURE_TYPES.has(value)
    ? (value as WritingSuggestion['structureType'])
    : undefined;
}

// ── Singleton ────────────────────────────────────────────────────────────────

let _writingAssistantService: WritingAssistantService | null = null;

export function getWritingAssistantService(): WritingAssistantService {
  if (!_writingAssistantService) {
    _writingAssistantService = new WritingAssistantService();
  }
  return _writingAssistantService;
}
