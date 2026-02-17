/**
 * File type utilities for chat file upload.
 *
 * Supported formats:
 * - Images: image/* (JPEG, PNG, WebP, GIF)
 * - PDF: application/pdf
 * - Text: text/plain, text/markdown, text/csv
 */

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

const DOCUMENT_MIME_TYPES = new Set(['application/pdf', 'text/plain', 'text/markdown', 'text/csv']);

/** Accept attribute value for the file input element. */
export const ACCEPTED_FILE_TYPES = 'image/*,application/pdf,text/plain,text/markdown,text/csv';

export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isDocumentFile(mimeType: string): boolean {
  return DOCUMENT_MIME_TYPES.has(mimeType);
}

export function isSupportedFile(mimeType: string): boolean {
  return isImageFile(mimeType) || isDocumentFile(mimeType);
}

/** Truncate long filenames for display, preserving the extension. */
export function getFileDisplayName(filename: string, maxLength = 30): string {
  if (filename.length <= maxLength) return filename;
  const ext = filename.slice(filename.lastIndexOf('.'));
  const nameLimit = maxLength - ext.length - 3; // 3 for "..."
  return filename.slice(0, nameLimit) + '...' + ext;
}
