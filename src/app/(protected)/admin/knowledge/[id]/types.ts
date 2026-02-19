import type { Json } from '@/types/database';

export interface SerializedDocument {
  id: string;
  userId: string;
  name: string;
  status: string;
  statusMessage: string | null;
  metadata: Json;
  docType: DocType;
  createdAt: string;
}

export interface Chunk {
  id: string;
  content: string;
  metadata: Json;
  embedding: number[] | null;
}

export type DocType = 'lecture' | 'exam' | 'assignment';

/** Safely read a string field from Json metadata */
export function metaStr(meta: Json, key: string): string {
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const val = (meta as Record<string, Json | undefined>)[key];
    return typeof val === 'string' ? val : '';
  }
  return '';
}

/** Resolve doc_type from document metadata */
export function resolveDocType(metadata: Json): DocType {
  const raw = metaStr(metadata, 'doc_type') || metaStr(metadata, 'docType');
  if (raw === 'exam' || raw === 'assignment') return raw;
  return 'lecture';
}

/** Status color mapping */
export function statusColor(status: string): string {
  switch (status) {
    case 'ready':
      return 'green';
    case 'processing':
      return 'yellow';
    case 'error':
      return 'red';
    case 'draft':
      return 'blue';
    default:
      return 'gray';
  }
}
