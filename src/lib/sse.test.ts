import { describe, expect, it } from 'vitest';
import { createSSEStream } from './sse';

describe('sse', () => {
  // ── createSSEStream ──

  describe('createSSEStream', () => {
    it('should return stream, send, and close functions', () => {
      const { stream, send, close } = createSSEStream();
      expect(stream).toBeInstanceOf(ReadableStream);
      expect(typeof send).toBe('function');
      expect(typeof close).toBe('function');
    });

    it('should enqueue events that can be read from the stream', async () => {
      const { stream, send, close } = createSSEStream();

      send('status', { stage: 'parsing_pdf', message: 'Starting...' });
      send('progress', { current: 1, total: 5 });
      close();

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toContain('event: status');
      expect(chunks[0]).toContain('parsing_pdf');
      expect(chunks[1]).toContain('event: progress');
      expect(chunks[1]).toContain('"current":1');
    });

    it('should handle double-close without throwing', () => {
      const { close } = createSSEStream();
      close();
      // Second close should not throw
      expect(() => close()).not.toThrow();
    });

    it('should produce valid SSE format from send', async () => {
      const { stream, send, close } = createSSEStream();

      send('error', { message: 'fail', code: 'ERR' });
      close();

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      const { value } = await reader.read();
      const text = decoder.decode(value!);

      // Validate SSE format: "event: <name>\ndata: <json>\n\n"
      const lines = text.split('\n');
      expect(lines[0]).toBe('event: error');
      expect(lines[1]).toMatch(/^data: \{.*\}$/);
      expect(lines[2]).toBe('');
      expect(lines[3]).toBe('');
    });

    it('should send multiple events in order', async () => {
      const { stream, send, close } = createSSEStream();

      send('status', { stage: 'extracting', message: 'Extracting...' });
      send('status', { stage: 'embedding', message: 'Embedding...' });
      send('status', { stage: 'complete', message: 'Done' });
      close();

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toContain('extracting');
      expect(chunks[1]).toContain('embedding');
      expect(chunks[2]).toContain('complete');
    });
  });
});
