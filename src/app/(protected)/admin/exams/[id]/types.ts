import type { Json } from '@/types/database';

export interface Chunk {
  id: string;
  content: string;
  metadata: Json;
  embedding: number[] | null;
}

export type DocType = 'lecture' | 'exam' | 'assignment';

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
