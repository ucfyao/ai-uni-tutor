import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_FILE_TYPES,
  getFileDisplayName,
  isDocumentFile,
  isImageFile,
  isSupportedFile,
  MAX_FILE_SIZE_BYTES,
} from './file-utils';

describe('file-utils', () => {
  describe('isImageFile', () => {
    it('returns true for image MIME types', () => {
      expect(isImageFile('image/jpeg')).toBe(true);
      expect(isImageFile('image/png')).toBe(true);
      expect(isImageFile('image/webp')).toBe(true);
      expect(isImageFile('image/gif')).toBe(true);
    });

    it('returns false for non-image types', () => {
      expect(isImageFile('application/pdf')).toBe(false);
      expect(isImageFile('text/plain')).toBe(false);
    });
  });

  describe('isDocumentFile', () => {
    it('returns true for PDF', () => {
      expect(isDocumentFile('application/pdf')).toBe(true);
    });

    it('returns true for text files', () => {
      expect(isDocumentFile('text/plain')).toBe(true);
      expect(isDocumentFile('text/markdown')).toBe(true);
      expect(isDocumentFile('text/csv')).toBe(true);
    });

    it('returns false for images', () => {
      expect(isDocumentFile('image/png')).toBe(false);
    });

    it('returns false for unsupported types', () => {
      expect(isDocumentFile('application/msword')).toBe(false);
    });
  });

  describe('isSupportedFile', () => {
    it('returns true for images and documents', () => {
      expect(isSupportedFile('image/png')).toBe(true);
      expect(isSupportedFile('application/pdf')).toBe(true);
      expect(isSupportedFile('text/plain')).toBe(true);
    });

    it('returns false for unsupported types', () => {
      expect(isSupportedFile('application/zip')).toBe(false);
      expect(isSupportedFile('video/mp4')).toBe(false);
    });
  });

  describe('getFileDisplayName', () => {
    it('truncates long filenames', () => {
      const longName = 'a'.repeat(50) + '.pdf';
      const result = getFileDisplayName(longName);
      expect(result.length).toBeLessThanOrEqual(35);
      expect(result).toContain('...');
      expect(result.endsWith('.pdf')).toBe(true);
    });

    it('keeps short filenames as-is', () => {
      expect(getFileDisplayName('slides.pdf')).toBe('slides.pdf');
    });
  });

  describe('constants', () => {
    it('MAX_FILE_SIZE_BYTES is 20MB', () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(20 * 1024 * 1024);
    });

    it('ACCEPTED_FILE_TYPES includes PDF and images', () => {
      expect(ACCEPTED_FILE_TYPES).toContain('application/pdf');
      expect(ACCEPTED_FILE_TYPES).toContain('image/*');
    });
  });
});
