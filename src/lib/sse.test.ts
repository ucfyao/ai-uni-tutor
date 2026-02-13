import { describe, expect, it } from 'vitest';
import { createSSEStream, sseEvent } from './sse';

describe('sse', () => {
  // ── sseEvent ──

  describe('sseEvent', () => {
    it('should format a status event correctly', () => {
      const result = sseEvent('status', { stage: 'parsing_pdf', message: 'Parsing...' });
      expect(result).toBe(
        `event: status\ndata: ${JSON.stringify({ stage: 'parsing_pdf', message: 'Parsing...' })}\n\n`,
      );
    });

    it('should format an error event correctly', () => {
      const result = sseEvent('error', { message: 'Something failed', code: 'PARSE_ERROR' });
      expect(result).toBe(
        `event: error\ndata: ${JSON.stringify({ message: 'Something failed', code: 'PARSE_ERROR' })}\n\n`,
      );
    });

    it('should format a progress event correctly', () => {
      const result = sseEvent('progress', { current: 3, total: 10 });
      expect(result).toBe(
        `event: progress\ndata: ${JSON.stringify({ current: 3, total: 10 })}\n\n`,
      );
    });

    it('should format a document_created event correctly', () => {
      const result = sseEvent('document_created', { documentId: 'doc-123' });
      expect(result).toBe(
        `event: document_created\ndata: ${JSON.stringify({ documentId: 'doc-123' })}\n\n`,
      );
    });

    it('should format a batch_saved event correctly', () => {
      const result = sseEvent('batch_saved', { chunkIds: ['a', 'b'], batchIndex: 0 });
      expect(result).toBe(
        `event: batch_saved\ndata: ${JSON.stringify({ chunkIds: ['a', 'b'], batchIndex: 0 })}\n\n`,
      );
    });

    it('should format an item event correctly', () => {
      const data = {
        index: 0,
        type: 'knowledge_point' as const,
        data: {
          title: 'Test',
          definition: 'A test',
          sourcePages: [1],
        },
      };
      const result = sseEvent('item', data);
      expect(result).toBe(`event: item\ndata: ${JSON.stringify(data)}\n\n`);
    });

    it('should produce output ending with double newline', () => {
      const result = sseEvent('status', { stage: 'complete', message: 'Done' });
      expect(result).toMatch(/\n\n$/);
    });

    it('should start with event: prefix', () => {
      const result = sseEvent('status', { stage: 'complete', message: 'Done' });
      expect(result).toMatch(/^event: status\n/);
    });
  });

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
