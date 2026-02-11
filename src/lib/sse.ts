import type { KnowledgePoint, ParsedQuestion } from '@/lib/rag/parsers/types';

// ─── SSE Event Payloads ───

export interface SSEStatusEvent {
  stage: 'parsing_pdf' | 'extracting' | 'embedding' | 'complete' | 'error';
  message: string;
}

export interface SSEItemEvent {
  index: number;
  type: 'knowledge_point' | 'question';
  data: KnowledgePoint | ParsedQuestion;
}

export interface SSEBatchSavedEvent {
  chunkIds: string[];
  batchIndex: number;
}

export interface SSEProgressEvent {
  current: number;
  total: number;
}

export interface SSEErrorEvent {
  message: string;
  code: string;
}

export interface SSEDocumentCreatedEvent {
  documentId: string;
}

export type SSEEventMap = {
  status: SSEStatusEvent;
  item: SSEItemEvent;
  batch_saved: SSEBatchSavedEvent;
  progress: SSEProgressEvent;
  error: SSEErrorEvent;
  document_created: SSEDocumentCreatedEvent;
};

// ─── SSE Formatting ───

export function sseEvent<K extends keyof SSEEventMap>(event: K, data: SSEEventMap[K]): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ─── SSE Response Helper ───

export function createSSEStream() {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  function send<K extends keyof SSEEventMap>(event: K, data: SSEEventMap[K]) {
    controller?.enqueue(encoder.encode(sseEvent(event, data)));
  }

  function close() {
    try {
      controller?.close();
    } catch {
      // already closed
    }
  }

  return { stream, send, close };
}
