'use client';

import { useCallback, useRef, useState } from 'react';
import type {
  EnrichedAssignmentItem,
  KnowledgePoint,
  ParsedQuestion,
} from '@/lib/rag/parsers/types';
import type { SSEEventMap } from '@/lib/sse';

type ParseStatus = 'idle' | 'parsing_pdf' | 'extracting' | 'embedding' | 'complete' | 'error';

interface ParsedItem {
  index: number;
  type: 'knowledge_point' | 'question';
  data: KnowledgePoint | ParsedQuestion | EnrichedAssignmentItem;
}

interface ParseMetadata {
  documentId: string; // record already exists
  docType: string;
  school?: string;
  course?: string;
  courseId?: string;
  hasAnswers?: boolean;
  reparse?: boolean;
  append?: boolean;
}

interface StageTime {
  start: number;
  end?: number;
}

interface PipelineDetail {
  phase: string;
  totalPages?: number;
  knowledgePointCount?: number;
  detail?: string;
}

export interface PipelineLogEntry {
  id: number;
  timestamp: number;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
}

interface StreamingParseState {
  startParse: (file: File, metadata: ParseMetadata) => void;
  retry: () => void;
  items: ParsedItem[];
  status: ParseStatus;
  progress: { current: number; total: number };
  savedChunkIds: Set<string>;
  error: string | null;
  errorCode: string | null;
  documentId: string | null;
  pipelineDetail: PipelineDetail | null;
  pipelineLogs: PipelineLogEntry[];
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
  const [pipelineDetail, setPipelineDetail] = useState<PipelineDetail | null>(null);
  const [pipelineLogs, setPipelineLogs] = useState<PipelineLogEntry[]>([]);
  const [stageTimes, setStageTimes] = useState<Record<string, StageTime>>({});
  const abortRef = useRef<AbortController | null>(null);
  const currentStageRef = useRef<string | null>(null);
  const lastFileRef = useRef<File | null>(null);
  const lastMetadataRef = useRef<ParseMetadata | null>(null);
  const logIdRef = useRef(0);
  const pipelineStartRef = useRef(0);

  function addLog(message: string, level: PipelineLogEntry['level']) {
    const entry: PipelineLogEntry = {
      id: ++logIdRef.current,
      timestamp: Date.now() - pipelineStartRef.current,
      message,
      level,
    };
    setPipelineLogs((prev) => [...prev, entry]);
  }

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setItems([]);
    setStatus('idle');
    setProgress({ current: 0, total: 0 });
    setSavedChunkIds(new Set());
    setError(null);
    setErrorCode(null);
    setDocumentId(null);
    setPipelineDetail(null);
    setPipelineLogs([]);
    setStageTimes({});
    currentStageRef.current = null;
  }, []);

  const startParse = useCallback((file: File, metadata: ParseMetadata) => {
    // Store for retry
    lastFileRef.current = file;
    lastMetadataRef.current = metadata;
    // Reset state
    setItems([]);
    setStatus('parsing_pdf');
    setProgress({ current: 0, total: 0 });
    setSavedChunkIds(new Set());
    setError(null);
    setErrorCode(null);
    setDocumentId(metadata.documentId);
    setPipelineDetail(null);
    setPipelineLogs([]);
    logIdRef.current = 0;
    const initialTime = Date.now();
    pipelineStartRef.current = initialTime;
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
    if (metadata.reparse) formData.append('reparse', 'true');
    if (metadata.append) formData.append('append', 'true');
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
        case 'pipeline_progress': {
          const pd = data as SSEEventMap['pipeline_progress'];
          setPipelineDetail({
            phase: pd.phase,
            totalPages: pd.totalPages,
            knowledgePointCount: pd.knowledgePointCount,
            detail: pd.detail,
          });
          break;
        }
        case 'log': {
          const logData = data as SSEEventMap['log'];
          addLog(logData.message, logData.level);
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

  const retry = useCallback(() => {
    if (lastFileRef.current && lastMetadataRef.current) {
      startParse(lastFileRef.current, lastMetadataRef.current);
    }
  }, [startParse]);

  return {
    startParse,
    retry,
    items,
    status,
    progress,
    savedChunkIds,
    error,
    errorCode,
    documentId,
    pipelineDetail,
    pipelineLogs,
    stageTimes,
    reset,
  };
}
