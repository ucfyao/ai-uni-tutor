import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import { GEMINI_MODELS } from '@/lib/gemini';
import type { WritingAnalysisRequest } from '@/types/writing';
import { WritingAssistantService } from './WritingAssistantService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGenerateContent = vi.fn();

vi.mock('@/lib/gemini', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/gemini')>();
  return {
    ...actual,
    getChatPool: () => ({
      withRetry: vi.fn().mockImplementation(async (fn: (entry: unknown) => unknown) => {
        const fakeEntry = {
          id: 0,
          provider: 'gemini',
          model: GEMINI_MODELS.chat,
          maskedKey: 'test****',
          client: {
            models: {
              generateContent: mockGenerateContent,
            },
          },
          disabled: false,
        };
        return fn(fakeEntry);
      }),
    }),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseRequest(overrides: Partial<WritingAnalysisRequest> = {}): WritingAnalysisRequest {
  return {
    content: 'This is a sample academic essay paragraph for testing.',
    services: ['format'],
    ...overrides,
  };
}

const SAMPLE_FORMAT_SUGGESTIONS = [
  {
    id: 'fmt-0',
    service: 'format',
    severity: 'warning',
    paragraphIndex: 0,
    startOffset: 5,
    endOffset: 10,
    originalText: 'is a',
    suggestedText: null,
    explanation: 'Consider removing filler phrase',
    riskScore: null,
    structureType: null,
  },
];

const SAMPLE_ORIGINALITY_SUGGESTIONS = [
  {
    id: 'orig-0',
    service: 'originality',
    severity: 'warning',
    paragraphIndex: 0,
    startOffset: 0,
    endOffset: 20,
    originalText: 'In conclusion, it is',
    suggestedText: null,
    explanation: 'Generic academic phrasing',
    riskScore: 75,
    structureType: null,
  },
  {
    id: 'orig-1',
    service: 'originality',
    severity: 'info',
    paragraphIndex: 1,
    startOffset: null,
    endOffset: null,
    originalText: null,
    suggestedText: null,
    explanation: 'Unattributed claim',
    riskScore: 45,
    structureType: null,
  },
];

const SAMPLE_STRUCTURE_SUGGESTIONS = [
  {
    id: 'str-0',
    service: 'structure',
    severity: 'suggestion',
    paragraphIndex: 1,
    startOffset: null,
    endOffset: null,
    originalText: null,
    suggestedText: 'Furthermore,',
    explanation: 'Missing transition between paragraphs',
    riskScore: null,
    structureType: 'transition',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WritingAssistantService', () => {
  let service: WritingAssistantService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WritingAssistantService();
  });

  // =========================================================================
  // Validation
  // =========================================================================
  describe('validation', () => {
    it('should throw VALIDATION error for empty content', async () => {
      await expect(service.analyze(baseRequest({ content: '   ' }))).rejects.toThrow(AppError);
      await expect(service.analyze(baseRequest({ content: '' }))).rejects.toThrow(
        'Content must not be empty',
      );
    });

    it('should throw VALIDATION error for empty services array', async () => {
      await expect(service.analyze(baseRequest({ services: [] }))).rejects.toThrow(AppError);
      await expect(service.analyze(baseRequest({ services: [] }))).rejects.toThrow(
        'At least one service must be selected',
      );
    });
  });

  // =========================================================================
  // Format service
  // =========================================================================
  describe('format service', () => {
    it('should return format suggestions from Gemini response', async () => {
      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(SAMPLE_FORMAT_SUGGESTIONS) });

      const results = await service.analyze(baseRequest({ services: ['format'] }));

      expect(results).toHaveLength(1);
      expect(results[0].service).toBe('format');
      expect(results[0].suggestions).toHaveLength(1);
      expect(results[0].suggestions[0].severity).toBe('warning');
      expect(results[0].suggestions[0].explanation).toBe('Consider removing filler phrase');
    });

    it('should include citation style in prompt when provided', async () => {
      mockGenerateContent.mockResolvedValue({ text: '[]' });

      await service.analyze(baseRequest({ services: ['format'], citationStyle: 'apa' }));

      const callArgs = mockGenerateContent.mock.calls[0][0];
      const promptText = callArgs.contents[0].parts[0].text;
      expect(promptText).toContain('APA');
    });

    it('should use low temperature (0.2) for analysis calls', async () => {
      mockGenerateContent.mockResolvedValue({ text: '[]' });

      await service.analyze(baseRequest());

      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.config.temperature).toBe(0.2);
    });

    it('should request JSON response MIME type', async () => {
      mockGenerateContent.mockResolvedValue({ text: '[]' });

      await service.analyze(baseRequest());

      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.config.responseMimeType).toBe('application/json');
    });
  });

  // =========================================================================
  // Polish service
  // =========================================================================
  describe('polish service', () => {
    it('should return polish suggestions', async () => {
      const polishSuggestions = [
        {
          id: 'pol-0',
          service: 'polish',
          severity: 'error',
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 4,
          originalText: 'Thsi',
          suggestedText: 'This',
          explanation: 'Spelling error',
          riskScore: null,
          structureType: null,
        },
      ];
      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(polishSuggestions) });

      const results = await service.analyze(baseRequest({ services: ['polish'] }));

      expect(results[0].service).toBe('polish');
      expect(results[0].suggestions[0].suggestedText).toBe('This');
      expect(results[0].suggestions[0].severity).toBe('error');
    });
  });

  // =========================================================================
  // Originality service
  // =========================================================================
  describe('originality service', () => {
    it('should compute overallScore from riskScores', async () => {
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(SAMPLE_ORIGINALITY_SUGGESTIONS),
      });

      const results = await service.analyze(baseRequest({ services: ['originality'] }));

      expect(results[0].service).toBe('originality');
      expect(results[0].overallScore).toBe(60); // (75 + 45) / 2 = 60
      expect(results[0].suggestions).toHaveLength(2);
    });

    it('should not set overallScore when no suggestions have riskScore', async () => {
      const noRiskSuggestions = [
        {
          id: 'orig-0',
          service: 'originality',
          severity: 'info',
          paragraphIndex: 0,
          explanation: 'Generic note',
        },
      ];
      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(noRiskSuggestions) });

      const results = await service.analyze(baseRequest({ services: ['originality'] }));

      expect(results[0].overallScore).toBeUndefined();
    });
  });

  // =========================================================================
  // Structure service
  // =========================================================================
  describe('structure service', () => {
    it('should return structure suggestions with structureType', async () => {
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(SAMPLE_STRUCTURE_SUGGESTIONS),
      });

      const results = await service.analyze(baseRequest({ services: ['structure'] }));

      expect(results[0].service).toBe('structure');
      expect(results[0].suggestions[0].structureType).toBe('transition');
    });
  });

  // =========================================================================
  // Multiple services
  // =========================================================================
  describe('multiple services', () => {
    it('should run multiple services in parallel and return all results', async () => {
      mockGenerateContent
        .mockResolvedValueOnce({ text: JSON.stringify(SAMPLE_FORMAT_SUGGESTIONS) })
        .mockResolvedValueOnce({ text: JSON.stringify(SAMPLE_STRUCTURE_SUGGESTIONS) });

      const results = await service.analyze(baseRequest({ services: ['format', 'structure'] }));

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.service)).toEqual(['format', 'structure']);
    });
  });

  // =========================================================================
  // Error handling & edge cases
  // =========================================================================
  describe('error handling', () => {
    it('should return empty suggestions for empty Gemini response', async () => {
      mockGenerateContent.mockResolvedValue({ text: '' });

      const results = await service.analyze(baseRequest());

      expect(results[0].suggestions).toEqual([]);
    });

    it('should return empty suggestions for invalid JSON', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGenerateContent.mockResolvedValue({ text: 'not valid json' });

      const results = await service.analyze(baseRequest());

      expect(results[0].suggestions).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should return empty suggestions when Gemini returns a non-array JSON', async () => {
      mockGenerateContent.mockResolvedValue({ text: '{"not": "an array"}' });

      const results = await service.analyze(baseRequest());

      expect(results[0].suggestions).toEqual([]);
    });

    it('should default severity to "suggestion" for unknown severity values', async () => {
      const badSeverity = [{ id: 'x', severity: 'critical', paragraphIndex: 0, explanation: 'x' }];
      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(badSeverity) });

      const results = await service.analyze(baseRequest());

      expect(results[0].suggestions[0].severity).toBe('suggestion');
    });

    it('should auto-generate IDs when Gemini omits them', async () => {
      const noId = [{ severity: 'info', paragraphIndex: 0, explanation: 'test' }];
      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(noId) });

      const results = await service.analyze(baseRequest());

      expect(results[0].suggestions[0].id).toBe('format-0');
    });

    it('should propagate provider errors', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Gemini 500'));

      await expect(service.analyze(baseRequest())).rejects.toThrow('Gemini 500');
    });
  });
});
