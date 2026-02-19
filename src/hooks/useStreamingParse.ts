'use client';

import { useCallback, useRef, useState } from 'react';
import type { KnowledgePoint, ParsedQuestion } from '@/lib/rag/parsers/types';
import type { SSEEventMap } from '@/lib/sse';

type ParseStatus = 'idle' | 'parsing_pdf' | 'extracting' | 'embedding' | 'complete' | 'error';

interface ParsedItem {
  index: number;
  type: 'knowledge_point' | 'question';
  data: KnowledgePoint | ParsedQuestion;
}

interface ParseMetadata {
  documentId: string; // record already exists
  docType: string;
  school?: string;
  course?: string;
  courseId?: string;
  hasAnswers?: boolean;
}

interface StageTime {
  start: number;
  end?: number;
}

interface StreamingParseState {
  startParse: (file: File, metadata: ParseMetadata) => void;
  items: ParsedItem[];
  status: ParseStatus;
  progress: { current: number; total: number };
  savedChunkIds: Set<string>;
  error: string | null;
  errorCode: string | null;
  documentId: string | null;
  stageTimes: Record<string, StageTime>;
  reset: () => void;
}

export function useStreamingParse(): StreamingParseState {
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [status, setStatus] = useState<ParseStatus>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [savedChunkIds, setSavedChunkIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [stageTimes, setStageTimes] = useState<Record<string, StageTime>>({});
  const abortRef = useRef<AbortController | null>(null);
  const currentStageRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setItems([]);
    setStatus('idle');
    setProgress({ current: 0, total: 0 });
    setSavedChunkIds(new Set());
    setError(null);
    setErrorCode(null);
    setDocumentId(null);
    setStageTimes({});
    currentStageRef.current = null;
  }, []);

  const startParse = useCallback((file: File, metadata: ParseMetadata) => {
    // Reset state
    setItems([]);
    setStatus('parsing_pdf');
    setProgress({ current: 0, total: 0 });
    setSavedChunkIds(new Set());
    setError(null);
    setErrorCode(null);
    setDocumentId(metadata.documentId);
    const initialTime = Date.now();
    setStageTimes({ parsing_pdf: { start: initialTime } });
    currentStageRef.current = 'parsing_pdf';

    const abortController = new AbortController();
    abortRef.current = abortController;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', metadata.docType);
    if (metadata.school) formData.append('school', metadata.school);
    if (metadata.course) formData.append('course', metadata.course);
    if (metadata.courseId) formData.append('courseId', metadata.courseId);
    if (metadata.hasAnswers) formData.append('has_answers', 'true');
    formData.append('documentId', metadata.documentId);

    (async () => {
      try {
        const response = await fetch('/api/documents/parse', {
          method: 'POST',
          body: formData,
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          setStatus('error');
          setError('Failed to connect to parse service');
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        // [I1] Persist across chunks so event/data pairs split across reads aren't lost
        let currentEvent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ') && currentEvent) {
              try {
                const data = JSON.parse(line.slice(6));
                handleSSEEvent(currentEvent, data);
              } catch {
                // Skip malformed data
              }
              currentEvent = '';
            }
          }
        }
      } catch (err) {
        if (abortController.signal.aborted) return;
        console.error('Streaming parse error:', err);
        setStatus('error');
        setError('Connection lost during parsing');
      }
    })();

    function handleSSEEvent(event: string, data: unknown) {
      switch (event) {
        case 'status': {
          const statusData = data as SSEEventMap['status'];
          const now = Date.now();
          if (statusData.stage === 'error') {
            setStatus('error');
            setError(statusData.message);
            // Close current stage on error
            if (currentStageRef.current) {
              const prev = currentStageRef.current;
              setStageTimes((t) => ({
                ...t,
                [prev]: { ...t[prev], end: now },
              }));
            }
          } else {
            // Close previous stage, open new stage
            const prevStage = currentStageRef.current;
            if (prevStage && prevStage !== statusData.stage) {
              setStageTimes((t) => ({
                ...t,
                [prevStage]: { ...t[prevStage], end: now },
                [statusData.stage]: { start: now },
              }));
            } else if (!prevStage) {
              setStageTimes((t) => ({
                ...t,
                [statusData.stage]: { start: now },
              }));
            }
            currentStageRef.current = statusData.stage;
            setStatus(statusData.stage);
          }
          break;
        }
        case 'item': {
          const itemData = data as SSEEventMap['item'];
          setItems((prev) => [...prev, itemData]);
          break;
        }
        case 'batch_saved': {
          const batchData = data as SSEEventMap['batch_saved'];
          setSavedChunkIds((prev) => {
            const next = new Set(prev);
            for (const id of batchData.chunkIds) next.add(id);
            return next;
          });
          break;
        }
        case 'progress': {
          const progressData = data as SSEEventMap['progress'];
          setProgress(progressData);
          break;
        }
        case 'error': {
          const errorData = data as SSEEventMap['error'];
          setStatus('error');
          setError(errorData.message);
          setErrorCode(errorData.code);
          break;
        }
      }
    }
  }, []);

  return {
    startParse,
    items,
    status,
    progress,
    savedChunkIds,
    error,
    errorCode,
    documentId,
    stageTimes,
    reset,
  };
}
