import type { Page } from '@playwright/test';

/**
 * Mock the /api/chat/stream SSE endpoint with a predictable text response.
 */
export async function mockGeminiStream(
  page: Page,
  response: string = 'This is a mock AI response for testing purposes.',
) {
  await page.route('**/api/chat/stream', async (route) => {
    const chunks = response.split(' ');
    const sseLines = chunks.map((chunk) => `data: ${JSON.stringify({ text: chunk + ' ' })}\n\n`);
    const body = sseLines.join('') + 'data: [DONE]\n\n';

    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
      body,
    });
  });
}

/**
 * Mock the /api/chat/stream to return an SSE error event (not HTTP error).
 * Matches actual format: data: {"error":"...","isLimitError":true}\n\n
 */
export async function mockGeminiError(
  page: Page,
  message = 'Rate limit exceeded',
  isLimitError = true,
) {
  await page.route('**/api/chat/stream', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
      body: `data: ${JSON.stringify({ error: message, isLimitError })}\n\n`,
    });
  });
}
