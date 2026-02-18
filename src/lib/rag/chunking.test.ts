import { describe, expect, it } from 'vitest';
import { chunkPages } from './chunking';

describe('chunking', () => {
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
