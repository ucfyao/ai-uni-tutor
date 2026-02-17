import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRequireAnyAdmin = vi.fn();
const mockRequireCourseAdmin = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  requireAnyAdmin: () => mockRequireAnyAdmin(),
  requireCourseAdmin: (courseId: string) => mockRequireCourseAdmin(courseId),
}));

const mockQuotaService = {
  enforce: vi.fn(),
};
vi.mock('@/lib/services/QuotaService', () => ({
  getQuotaService: () => mockQuotaService,
}));

const mockDocumentService = {
  checkDuplicate: vi.fn(),
  createDocument: vi.fn(),
  updateStatus: vi.fn(),
  saveChunksAndReturn: vi.fn(),
};
vi.mock('@/lib/services/DocumentService', () => ({
  getDocumentService: () => mockDocumentService,
}));

const mockParsePDF = vi.fn();
vi.mock('@/lib/pdf', () => ({
  parsePDF: (...args: unknown[]) => mockParsePDF(...args),
}));

const mockGenerateEmbeddingWithRetry = vi.fn();
vi.mock('@/lib/rag/embedding', () => ({
  generateEmbeddingWithRetry: (...args: unknown[]) => mockGenerateEmbeddingWithRetry(...args),
}));

// Mock parsers that are dynamically imported
const mockParseLecture = vi.fn();
vi.mock('@/lib/rag/parsers/lecture-parser', () => ({
  parseLecture: (...args: unknown[]) => mockParseLecture(...args),
}));

const mockParseQuestions = vi.fn();
vi.mock('@/lib/rag/parsers/question-parser', () => ({
  parseQuestions: (...args: unknown[]) => mockParseQuestions(...args),
}));

const mockExamPaperRepo = {
  create: vi.fn(),
  updateStatus: vi.fn(),
  insertQuestions: vi.fn(),
  updatePaper: vi.fn(),
};
vi.mock('@/lib/repositories/ExamPaperRepository', () => ({
  getExamPaperRepository: () => mockExamPaperRepo,
}));

const mockAssignmentRepo = {
  create: vi.fn(),
  updateStatus: vi.fn(),
  insertItems: vi.fn(),
};
vi.mock('@/lib/repositories/AssignmentRepository', () => ({
  getAssignmentRepository: () => mockAssignmentRepo,
}));

// ---------------------------------------------------------------------------
// Import route handler (after mocks are registered)
// ---------------------------------------------------------------------------

const { POST } = await import('./route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

const MOCK_KNOWLEDGE_POINT = {
  title: 'Algorithm Basics',
  definition: 'A step-by-step procedure',
  sourcePages: [1],
  keyFormulas: ['O(n)'],
  keyConcepts: ['complexity'],
  examples: ['sorting'],
};

const MOCK_QUESTION = {
  questionNumber: 1,
  content: 'What is O(n)?',
  options: ['A', 'B'],
  referenceAnswer: 'Linear time',
};

/** Build valid PDF bytes (starting with %PDF- magic bytes) */
function makePDFBytes(content = 'some text') {
  const header = '%PDF-1.4\n';
  const body = content;
  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(header);
  const bodyBytes = encoder.encode(body);
  const combined = new Uint8Array(headerBytes.length + bodyBytes.length);
  combined.set(headerBytes, 0);
  combined.set(bodyBytes, headerBytes.length);
  return new Blob([combined]);
}

/** Create a FormData-based Request for the parse endpoint. */
function makeRequest(overrides?: {
  file?: File | null;
  doc_type?: string;
  school?: string;
  course?: string;
  has_answers?: string;
  skipFile?: boolean;
}): Request {
  const formData = new FormData();

  if (!overrides?.skipFile) {
    const file =
      overrides?.file ?? new File([makePDFBytes()], 'lecture.pdf', { type: 'application/pdf' });
    formData.append('file', file);
  }

  // Always send school and course (browser forms always include input fields, even if empty)
  formData.append('doc_type', overrides?.doc_type ?? 'lecture');
  formData.append('school', overrides?.school ?? '');
  formData.append('course', overrides?.course ?? '');
  formData.append('has_answers', overrides?.has_answers ?? 'false');

  return new Request('http://localhost/api/documents/parse', {
    method: 'POST',
    body: formData,
  });
}

/** Parse all SSE events from a response stream. */
async function readSSEEvents(response: Response): Promise<Array<{ event: string; data: unknown }>> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
  }

  const events: Array<{ event: string; data: unknown }> = [];
  const rawEvents = buffer.split('\n\n').filter(Boolean);

  for (const raw of rawEvents) {
    const lines = raw.split('\n');
    let eventType = '';
    let dataStr = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7);
      } else if (line.startsWith('data: ')) {
        dataStr = line.slice(6);
      }
    }

    if (eventType && dataStr) {
      try {
        events.push({ event: eventType, data: JSON.parse(dataStr) });
      } catch {
        events.push({ event: eventType, data: dataStr });
      }
    }
  }

  return events;
}

/** Find the first event of a given type from the SSE events. */
function findEvent(events: Array<{ event: string; data: unknown }>, type: string) {
  return events.find((e) => e.event === type);
}

/** Find all events of a given type from the SSE events. */
function findEvents(events: Array<{ event: string; data: unknown }>, type: string) {
  return events.filter((e) => e.event === type);
}

// ---------------------------------------------------------------------------
// Default mock setup: a successful end-to-end parse
// ---------------------------------------------------------------------------

function setupSuccessfulParse() {
  mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });
  mockQuotaService.enforce.mockResolvedValue(undefined);
  mockDocumentService.checkDuplicate.mockResolvedValue(false);
  mockDocumentService.createDocument.mockResolvedValue({
    id: 'doc-123',
    userId: MOCK_USER.id,
    name: 'lecture.pdf',
    status: 'processing',
  });
  mockDocumentService.updateStatus.mockResolvedValue(undefined);
  mockDocumentService.saveChunksAndReturn.mockResolvedValue([{ id: 'chunk-1' }]);
  mockParsePDF.mockResolvedValue({
    pages: [{ text: 'Some lecture content about algorithms' }],
  });
  mockGenerateEmbeddingWithRetry.mockResolvedValue(Array.from({ length: 768 }, () => 0.01));
  mockParseLecture.mockResolvedValue([MOCK_KNOWLEDGE_POINT]);
  mockParseQuestions.mockResolvedValue([MOCK_QUESTION]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/documents/parse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Response format
  // =========================================================================

  describe('response format', () => {
    it('returns SSE content-type headers', async () => {
      setupSuccessfulParse();
      const response = await POST(makeRequest());

      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');

      // Consume stream to prevent leaks
      await readSSEEvents(response);
    });
  });

  // =========================================================================
  // Authentication
  // =========================================================================

  describe('authentication', () => {
    it('sends error event with FORBIDDEN code when user is not admin', async () => {
      mockRequireAnyAdmin.mockRejectedValue(new Error('Admin access required'));

      const response = await POST(makeRequest());
      const events = await readSSEEvents(response);

      const errorEvent = findEvent(events, 'error');
      expect(errorEvent).toBeDefined();
      expect((errorEvent!.data as any).code).toBe('FORBIDDEN');
      expect((errorEvent!.data as any).message).toBe('Admin access required');
    });
  });

  // =========================================================================
  // Quota enforcement
  // =========================================================================

  describe('quota enforcement', () => {
    it('sends error event with QUOTA_EXCEEDED code when quota is exceeded', async () => {
      mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });

      const { QuotaExceededError } = await import('@/lib/errors');
      mockQuotaService.enforce.mockRejectedValue(new QuotaExceededError(10, 10));

      const response = await POST(makeRequest());
      const events = await readSSEEvents(response);

      const errorEvent = findEvent(events, 'error');
      expect(errorEvent).toBeDefined();
      expect((errorEvent!.data as any).code).toBe('QUOTA_EXCEEDED');
    });

    it('sends error event with QUOTA_ERROR code for generic quota failures', async () => {
      mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });
      mockQuotaService.enforce.mockRejectedValue(new Error('Redis connection failed'));

      const response = await POST(makeRequest());
      const events = await readSSEEvents(response);

      const errorEvent = findEvent(events, 'error');
      expect(errorEvent).toBeDefined();
      expect((errorEvent!.data as any).code).toBe('QUOTA_ERROR');
    });
  });

  // =========================================================================
  // File validation
  // =========================================================================

  describe('file validation', () => {
    it('sends error event with INVALID_FILE code when no file is provided', async () => {
      mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });
      mockQuotaService.enforce.mockResolvedValue(undefined);

      const response = await POST(makeRequest({ skipFile: true }));
      const events = await readSSEEvents(response);

      const errorEvent = findEvent(events, 'error');
      expect(errorEvent).toBeDefined();
      expect((errorEvent!.data as any).code).toBe('INVALID_FILE');
      expect((errorEvent!.data as any).message).toBe('Only PDF files are supported');
    });

    it('sends error event with INVALID_FILE code when file is not PDF type', async () => {
      mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });
      mockQuotaService.enforce.mockResolvedValue(undefined);

      const file = new File(['hello world'], 'notes.txt', { type: 'text/plain' });
      const response = await POST(makeRequest({ file }));
      const events = await readSSEEvents(response);

      const errorEvent = findEvent(events, 'error');
      expect(errorEvent).toBeDefined();
      expect((errorEvent!.data as any).code).toBe('INVALID_FILE');
    });

    it('sends error event with FILE_TOO_LARGE code when file exceeds size limit', async () => {
      mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });
      mockQuotaService.enforce.mockResolvedValue(undefined);

      // Create a file larger than MAX_FILE_SIZE (default 10MB)
      const largeContent = new Uint8Array(11 * 1024 * 1024);
      const file = new File([largeContent], 'huge.pdf', { type: 'application/pdf' });

      const response = await POST(makeRequest({ file }));
      const events = await readSSEEvents(response);

      const errorEvent = findEvent(events, 'error');
      expect(errorEvent).toBeDefined();
      expect((errorEvent!.data as any).code).toBe('FILE_TOO_LARGE');
    });

    it('sends error event with INVALID_FILE code when PDF has invalid magic bytes', async () => {
      mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });
      mockQuotaService.enforce.mockResolvedValue(undefined);
      mockDocumentService.checkDuplicate.mockResolvedValue(false);
      mockDocumentService.createDocument.mockResolvedValue({
        id: 'doc-123',
        userId: MOCK_USER.id,
        name: 'fake.pdf',
        status: 'processing',
      });
      mockDocumentService.updateStatus.mockResolvedValue(undefined);

      // File with PDF mime type but invalid content (no %PDF- magic bytes)
      const fakeContent = new TextEncoder().encode('NOT A REAL PDF FILE');
      const file = new File([fakeContent], 'fake.pdf', { type: 'application/pdf' });

      const response = await POST(makeRequest({ file }));
      const events = await readSSEEvents(response);

      const errorEvent = findEvent(events, 'error');
      expect(errorEvent).toBeDefined();
      expect((errorEvent!.data as any).code).toBe('INVALID_FILE');
      expect((errorEvent!.data as any).message).toBe('File is not a valid PDF');
    });
  });

  // =========================================================================
  // Form data validation
  // =========================================================================

  describe('form data validation', () => {
    it('sends error event with VALIDATION_ERROR code for invalid doc_type', async () => {
      mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });
      mockQuotaService.enforce.mockResolvedValue(undefined);

      // Build FormData manually with invalid doc_type but valid file
      const formData = new FormData();
      formData.append(
        'file',
        new File([makePDFBytes()], 'lecture.pdf', { type: 'application/pdf' }),
      );
      formData.append('doc_type', 'invalid_type');
      formData.append('school', '');
      formData.append('course', '');

      const request = new Request('http://localhost/api/documents/parse', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const events = await readSSEEvents(response);

      const errorEvent = findEvent(events, 'error');
      expect(errorEvent).toBeDefined();
      expect((errorEvent!.data as any).code).toBe('VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // Duplicate check
  // =========================================================================

  describe('duplicate check', () => {
    it('sends error event with DUPLICATE code when file already exists', async () => {
      mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });
      mockQuotaService.enforce.mockResolvedValue(undefined);
      mockDocumentService.checkDuplicate.mockResolvedValue(true);

      const response = await POST(makeRequest());
      const events = await readSSEEvents(response);

      const errorEvent = findEvent(events, 'error');
      expect(errorEvent).toBeDefined();
      expect((errorEvent!.data as any).code).toBe('DUPLICATE');
      expect((errorEvent!.data as any).message).toContain('already exists');
    });
  });

  // =========================================================================
  // SSE event flow: successful parse
  // =========================================================================

  describe('successful parse flow', () => {
    it('sends document_created event after creating document record', async () => {
      setupSuccessfulParse();

      const response = await POST(makeRequest());
      const events = await readSSEEvents(response);

      const docCreated = findEvent(events, 'document_created');
      expect(docCreated).toBeDefined();
      expect((docCreated!.data as any).documentId).toBe('doc-123');
    });

    it('sends status events through the full pipeline', async () => {
      setupSuccessfulParse();

      const response = await POST(makeRequest());
      const events = await readSSEEvents(response);

      const statusEvents = findEvents(events, 'status');
      const stages = statusEvents.map((e) => (e.data as any).stage);

      expect(stages).toContain('parsing_pdf');
      expect(stages).toContain('extracting');
      expect(stages).toContain('embedding');
      expect(stages).toContain('complete');
    });

    it('sends item events for each extracted knowledge point', async () => {
      setupSuccessfulParse();

      const response = await POST(makeRequest());
      const events = await readSSEEvents(response);

      const itemEvents = findEvents(events, 'item');
      expect(itemEvents.length).toBeGreaterThan(0);
      expect((itemEvents[0].data as any).index).toBe(0);
      expect((itemEvents[0].data as any).type).toBe('knowledge_point');
    });

    it('sends progress events tracking extraction progress', async () => {
      setupSuccessfulParse();

      const response = await POST(makeRequest());
      const events = await readSSEEvents(response);

      const progressEvents = findEvents(events, 'progress');
      expect(progressEvents.length).toBeGreaterThan(0);

      // Last progress event should have current === total
      const lastProgress = progressEvents[progressEvents.length - 1].data as any;
      expect(lastProgress.current).toBe(lastProgress.total);
    });

    it('sends batch_saved events with chunk IDs', async () => {
      setupSuccessfulParse();

      const response = await POST(makeRequest());
      const events = await readSSEEvents(response);

      const batchEvents = findEvents(events, 'batch_saved');
      expect(batchEvents.length).toBeGreaterThan(0);
      expect((batchEvents[0].data as any).chunkIds).toEqual(['chunk-1']);
      expect((batchEvents[0].data as any).batchIndex).toBe(0);
    });

    it('sends complete status event at the end', async () => {
      setupSuccessfulParse();

      const response = await POST(makeRequest());
      const events = await readSSEEvents(response);

      const statusEvents = findEvents(events, 'status');
      const lastStatus = statusEvents[statusEvents.length - 1];
      expect((lastStatus.data as any).stage).toBe('complete');
      expect((lastStatus.data as any).message).toContain('Done');
    });
  });

  // =========================================================================
  // Exam/assignment doc type
  // =========================================================================

  describe('exam doc type', () => {
    it('sends question-type items for exam documents', async () => {
      setupSuccessfulParse();
      mockExamPaperRepo.create.mockResolvedValue('exam-123');
      mockExamPaperRepo.insertQuestions.mockResolvedValue(undefined);
      mockExamPaperRepo.updateStatus.mockResolvedValue(undefined);
      mockExamPaperRepo.updatePaper.mockResolvedValue(undefined);

      const response = await POST(makeRequest({ doc_type: 'exam' }));
      const events = await readSSEEvents(response);

      const itemEvents = findEvents(events, 'item');
      expect(itemEvents.length).toBeGreaterThan(0);
      expect((itemEvents[0].data as any).type).toBe('question');
    });
  });

  // =========================================================================
  // PDF parse failure
  // =========================================================================

  describe('PDF parse failure', () => {
    it('sends error event with PDF_PARSE_ERROR when PDF parsing fails', async () => {
      setupSuccessfulParse();
      mockParsePDF.mockRejectedValue(new Error('Corrupt PDF'));

      const response = await POST(makeRequest());
      const events = await readSSEEvents(response);

      const errorEvent = findEvent(events, 'error');
      expect(errorEvent).toBeDefined();
      expect((errorEvent!.data as any).code).toBe('PDF_PARSE_ERROR');
    });
  });

  // =========================================================================
  // Empty PDF
  // =========================================================================

  describe('empty PDF', () => {
    it('sends error event with EMPTY_PDF when PDF has no text', async () => {
      setupSuccessfulParse();
      mockParsePDF.mockResolvedValue({ pages: [{ text: '' }] });

      const response = await POST(makeRequest());
      const events = await readSSEEvents(response);

      const errorEvent = findEvent(events, 'error');
      expect(errorEvent).toBeDefined();
      expect((errorEvent!.data as any).code).toBe('EMPTY_PDF');
    });
  });

  // =========================================================================
  // LLM extraction failure
  // =========================================================================

  describe('LLM extraction failure', () => {
    it('sends error event with EXTRACTION_ERROR when LLM extraction fails', async () => {
      setupSuccessfulParse();
      mockParseLecture.mockRejectedValue(new Error('Gemini API error'));

      const response = await POST(makeRequest());
      const events = await readSSEEvents(response);

      const errorEvent = findEvent(events, 'error');
      expect(errorEvent).toBeDefined();
      expect((errorEvent!.data as any).code).toBe('EXTRACTION_ERROR');
    });
  });

  // =========================================================================
  // No items extracted
  // =========================================================================

  describe('no items extracted', () => {
    it('sends progress 0/0 and complete status when no items are extracted', async () => {
      setupSuccessfulParse();
      mockParseLecture.mockResolvedValue([]);

      const response = await POST(makeRequest());
      const events = await readSSEEvents(response);

      const progressEvents = findEvents(events, 'progress');
      expect(progressEvents.length).toBeGreaterThan(0);
      expect((progressEvents[0].data as any).current).toBe(0);
      expect((progressEvents[0].data as any).total).toBe(0);

      const statusEvents = findEvents(events, 'status');
      const lastStatus = statusEvents[statusEvents.length - 1];
      expect((lastStatus.data as any).stage).toBe('complete');
      expect((lastStatus.data as any).message).toContain('No content');
    });
  });

  // =========================================================================
  // Unexpected pipeline error
  // =========================================================================

  describe('unexpected pipeline error', () => {
    it('sends INTERNAL_ERROR when an unexpected error occurs after doc creation', async () => {
      setupSuccessfulParse();
      // Make saveChunksAndReturn throw to simulate unexpected error
      mockDocumentService.saveChunksAndReturn.mockRejectedValue(new Error('DB write failure'));

      const response = await POST(makeRequest());
      const events = await readSSEEvents(response);

      const errorEvent = findEvent(events, 'error');
      expect(errorEvent).toBeDefined();
      expect((errorEvent!.data as any).code).toBe('INTERNAL_ERROR');
    });
  });

  // =========================================================================
  // Document service interactions
  // =========================================================================

  describe('service interactions', () => {
    it('calls checkDuplicate with user ID and file name', async () => {
      setupSuccessfulParse();

      const response = await POST(makeRequest());
      await readSSEEvents(response);

      expect(mockDocumentService.checkDuplicate).toHaveBeenCalledWith(MOCK_USER.id, 'lecture.pdf');
    });

    it('calls createDocument with correct params', async () => {
      setupSuccessfulParse();

      const response = await POST(makeRequest({ school: 'MIT', course: 'CS101' }));
      await readSSEEvents(response);

      expect(mockDocumentService.createDocument).toHaveBeenCalledWith(
        MOCK_USER.id,
        'lecture.pdf',
        { school: 'MIT', course: 'CS101' },
        'lecture',
      );
    });

    it('defaults school and course when not provided', async () => {
      setupSuccessfulParse();

      const response = await POST(makeRequest());
      await readSSEEvents(response);

      expect(mockDocumentService.createDocument).toHaveBeenCalledWith(
        MOCK_USER.id,
        'lecture.pdf',
        { school: 'Unspecified', course: 'General' },
        'lecture',
      );
    });

    it('calls generateEmbeddingWithRetry for each item', async () => {
      setupSuccessfulParse();

      const response = await POST(makeRequest());
      await readSSEEvents(response);

      expect(mockGenerateEmbeddingWithRetry).toHaveBeenCalledTimes(1);
      expect(mockGenerateEmbeddingWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('Algorithm Basics'),
      );
    });

    it('updates status to ready on successful completion', async () => {
      setupSuccessfulParse();

      const response = await POST(makeRequest());
      await readSSEEvents(response);

      // Last updateStatus call should be 'ready'
      const calls = mockDocumentService.updateStatus.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe('doc-123');
      expect(lastCall[1]).toBe('ready');
    });
  });
});
