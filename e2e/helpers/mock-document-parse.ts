import type { Page } from '@playwright/test';

/**
 * Helper to build a named SSE event string.
 * Format: event: <type>\ndata: <json>\n\n
 */
function sseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Mock /api/documents/parse with named SSE events matching actual API format.
 * Event types: document_created, status, progress, item, batch_saved, error
 */
export async function mockDocumentParse(page: Page, documentId: string = 'test-doc-1') {
  await page.route('**/api/documents/parse', async (route) => {
    const events = [
      sseEvent('document_created', { documentId }),
      sseEvent('status', { stage: 'parsing_pdf', message: 'Parsing PDF...' }),
      sseEvent('status', { stage: 'extracting', message: 'Extracting content...' }),
      sseEvent('progress', { current: 1, total: 3 }),
      sseEvent('item', { index: 0, type: 'knowledge_point', data: { title: 'Test Point' } }),
      sseEvent('progress', { current: 2, total: 3 }),
      sseEvent('item', { index: 1, type: 'knowledge_point', data: { title: 'Test Point 2' } }),
      sseEvent('batch_saved', { chunkIds: ['chunk-1', 'chunk-2'], batchIndex: 0 }),
      sseEvent('status', { stage: 'embedding', message: 'Generating embeddings...' }),
      sseEvent('progress', { current: 3, total: 3 }),
      sseEvent('status', { stage: 'complete', message: 'Processing complete' }),
    ].join('');

    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
      body: events,
    });
  });
}

/**
 * Mock document parse failure with named SSE error event.
 */
export async function mockDocumentParseError(page: Page) {
  await page.route('**/api/documents/parse', async (route) => {
    const events = [
      sseEvent('status', { stage: 'parsing_pdf', message: 'Parsing PDF...' }),
      sseEvent('error', { message: 'Failed to process document', code: 'VALIDATION_ERROR' }),
    ].join('');

    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: events,
    });
  });
}
