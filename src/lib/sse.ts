import type { KnowledgePoint, ParsedQuestion, PipelineProgress } from '@/lib/rag/parsers/types';

// ─── SSE Event Payloads ───

interface SSEStatusEvent {
  stage: 'parsing_pdf' | 'extracting' | 'embedding' | 'complete' | 'error';
  message: string;
}

interface SSEItemEvent {
  index: number;
  type: 'knowledge_point' | 'question';
  data: KnowledgePoint | ParsedQuestion;
}

interface SSEBatchSavedEvent {
  chunkIds: string[];
  batchIndex: number;
}

interface SSEProgressEvent {
  current: number;
  total: number;
}

interface SSEErrorEvent {
  message: string;
  code: string;
}

interface SSEDocumentCreatedEvent {
  documentId: string;
}

interface SSELogEvent {
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
}

export type SSEEventMap = {
  status: SSEStatusEvent;
  item: SSEItemEvent;
  batch_saved: SSEBatchSavedEvent;
  progress: SSEProgressEvent;
  error: SSEErrorEvent;
  document_created: SSEDocumentCreatedEvent;
  pipeline_progress: PipelineProgress;
  log: SSELogEvent;
};

// ─── SSE Formatting ───

function sseEvent<K extends keyof SSEEventMap>(event: K, data: SSEEventMap[K]): string {
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
