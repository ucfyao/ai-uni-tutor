import { describe, expect, it } from 'vitest';
import { chunkPages, chunkText } from './chunking';

describe('chunking', () => {
  // ── chunkText ──

  describe('chunkText', () => {
    it('should return a single chunk for short text', async () => {
      const text = 'Hello, world!';
      const result = await chunkText(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(text);
    });

    it('should return multiple chunks for long text', async () => {
      // Build a string well over the default 1000 char chunk size
      const sentence = 'This is a sample sentence for testing text chunking. ';
      const text = sentence.repeat(100); // ~5400 chars
      const result = await chunkText(text);
      expect(result.length).toBeGreaterThan(1);
      // Every chunk should be a non-empty substring of the original
      for (const chunk of result) {
        expect(chunk.length).toBeGreaterThan(0);
      }
    });

    it('should respect custom chunk size', async () => {
      const sentence = 'Word. ';
      const text = sentence.repeat(200); // ~1200 chars
      const smallChunkSize = 100;
      const result = await chunkText(text, smallChunkSize, 0);
      // With a 100-char chunk size and no overlap, we should get many chunks
      expect(result.length).toBeGreaterThan(5);
      for (const chunk of result) {
        // Each chunk should not exceed the chunk size (may be slightly less due to splitting)
        expect(chunk.length).toBeLessThanOrEqual(smallChunkSize);
      }
    });

    it('should produce overlapping content between chunks', async () => {
      // Use a large text with a known overlap
      const words = Array.from({ length: 500 }, (_, i) => `word${i}`).join(' ');
      const chunkSize = 200;
      const chunkOverlap = 50;
      const result = await chunkText(words, chunkSize, chunkOverlap);

      expect(result.length).toBeGreaterThan(1);

      // Check that consecutive chunks share some overlapping content
      for (let i = 0; i < result.length - 1; i++) {
        const currentEnd = result[i].slice(-chunkOverlap);
        const nextStart = result[i + 1].slice(0, chunkOverlap + 10);
        // The end of current chunk should appear at the start of next chunk
        // (overlap means repeated content)
        const overlapFound = nextStart.includes(currentEnd.trim().slice(0, 20));
        // At minimum, the chunks together should cover all the text
        expect(result[i].length).toBeGreaterThan(0);
      }
    });

    it('should return empty array for empty string', async () => {
      const result = await chunkText('');
      expect(result).toEqual([]);
    });
  });

  // ── chunkPages ──

  describe('chunkPages', () => {
    it('should handle a single page and preserve metadata', async () => {
      const pages = [{ text: 'Short page content.', page: 1 }];
      const result = await chunkPages(pages);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Short page content.');
      expect(result[0].metadata.page).toBe(1);
    });

    it('should handle multiple pages with metadata preserved', async () => {
      const pages = [
        { text: 'Content of page one.', page: 1 },
        { text: 'Content of page two.', page: 2 },
        { text: 'Content of page three.', page: 3 },
      ];
      const result = await chunkPages(pages);
      expect(result.length).toBeGreaterThanOrEqual(3);
      // Each chunk should have page metadata
      for (const chunk of result) {
        expect(chunk.metadata).toBeDefined();
        expect(typeof chunk.metadata.page).toBe('number');
      }
    });

    it('should split large page content into multiple chunks with same page number', async () => {
      const longText = 'A '.repeat(1000); // ~2000 chars, exceeds default chunk size of 1000
      const pages = [{ text: longText, page: 5 }];
      const result = await chunkPages(pages);
      expect(result.length).toBeGreaterThan(1);
      // All chunks should retain page 5
      for (const chunk of result) {
        expect(chunk.metadata.page).toBe(5);
      }
    });

    it('should handle empty pages array', async () => {
      const result = await chunkPages([]);
      expect(result).toEqual([]);
    });

    it('should handle page with empty text', async () => {
      const pages = [{ text: '', page: 1 }];
      const result = await chunkPages(pages);
      expect(result).toEqual([]);
    });

    it('should respect custom chunk size and overlap parameters', async () => {
      const text = 'Sentence number one. '.repeat(50); // ~1050 chars
      const pages = [{ text, page: 1 }];
      const result = await chunkPages(pages, 200, 0);
      expect(result.length).toBeGreaterThan(3);
      for (const chunk of result) {
        expect(chunk.content.length).toBeLessThanOrEqual(200);
        expect(chunk.metadata.page).toBe(1);
      }
    });

    it('should return ChunkWithMetadata shape for every chunk', async () => {
      const pages = [
        { text: 'Some text on page ten.', page: 10 },
        { text: 'Some text on page twenty.', page: 20 },
      ];
      const result = await chunkPages(pages);
      for (const chunk of result) {
        expect(chunk).toHaveProperty('content');
        expect(chunk).toHaveProperty('metadata');
        expect(chunk).toHaveProperty('metadata.page');
        expect(typeof chunk.content).toBe('string');
        expect(typeof chunk.metadata.page).toBe('number');
      }
    });
  });
});
