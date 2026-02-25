import { useCallback, useRef, useState } from 'react';
import type { ChatSource } from '@/types';

const STREAM_TIMEOUT_MS = 60000; // 60 seconds timeout
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];

interface StreamChatOptions {
  course: { code: string; name: string };
  mode: string | null;
  history: { role: string; content: string; images?: { data: string; mimeType: string }[] }[];
  userInput: string;
  images?: { data: string; mimeType: string }[];
  document?: { data: string; mimeType: string };
}

interface StreamCallbacks {
  onChunk: (text: string) => void;
  onError: (error: string, isLimitError?: boolean, isRetryable?: boolean) => void;
  onComplete: () => void | Promise<void>;
  onSources?: (sources: ChatSource[]) => void;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useChatStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isReconnecting, setReconnecting] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const streamChatResponse = useCallback(
    async (options: StreamChatOptions, callbacks: StreamCallbacks) => {
      const { course, mode, history, userInput, images = [], document } = options;
      const { onChunk, onError, onComplete, onSources } = callbacks;

      cancelledRef.current = false;
      setIsStreaming(true);

      const requestId = crypto.randomUUID();
      let chunkIndex = 0;

      const attemptStream = async (resumeFrom?: number): Promise<boolean> => {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

        try {
          const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              course,
              mode,
              history,
              userInput,
              images,
              document,
              requestId,
              ...(resumeFrom !== undefined && { resumeFrom }),
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json();
            onError(
              errorData.error || 'Failed to generate response',
              errorData.isLimitError,
              false,
            );
            return true; // non-retryable server error — stop
          }

          const reader = response.body?.getReader();
          if (!reader) {
            onError('Failed to read response stream', false, true);
            return true; // stop
          }

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (!data) continue;
                if (data === '[DONE]') {
                  await onComplete();
                  setIsStreaming(false);
                  setStreamingMsgId(null);
                  return true; // success — stop
                }
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.sources && onSources) {
                    onSources(parsed.sources);
                  } else if (parsed.text) {
                    chunkIndex++;
                    onChunk(parsed.text);
                  } else if (parsed.error) {
                    onError(parsed.error, parsed.isLimitError, true);
                    setIsStreaming(false);
                    return true; // server-side error — stop
                  }
                } catch {
                  // Ignore parse errors for partial chunks
                }
              }
            }
          }

          // Process any remaining buffer
          if (buffer.startsWith('data: ')) {
            const data = buffer.slice(6).trim();
            if (data && data !== '[DONE]') {
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  chunkIndex++;
                  onChunk(parsed.text);
                } else if (parsed.error) {
                  onError(parsed.error, parsed.isLimitError, true);
                  setIsStreaming(false);
                  return true; // stop
                }
              } catch {
                // ignore
              }
            }
          }

          await onComplete();
          setIsStreaming(false);
          setStreamingMsgId(null);
          return true; // success
        } catch (error) {
          clearTimeout(timeoutId);

          if (cancelledRef.current) {
            // User clicked stop — keep partial response
            try {
              await onComplete();
            } catch {
              // ignore errors during cancel completion
            }
            setIsStreaming(false);
            setStreamingMsgId(null);
            return true; // user cancelled — stop, don't retry
          }

          if (error instanceof Error && error.name === 'AbortError') {
            // Timeout — retryable
            return false;
          }

          // Network error — retryable
          console.error('Stream error:', error);
          return false;
        }
      };

      try {
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          if (attempt > 0) {
            setReconnecting(true);
            await delay(RETRY_DELAYS[attempt - 1]);

            // Check if user cancelled during the delay
            if (cancelledRef.current) {
              setReconnecting(false);
              setIsStreaming(false);
              setStreamingMsgId(null);
              return;
            }
          }

          const done = await attemptStream(attempt > 0 ? chunkIndex : undefined);
          if (done) {
            setReconnecting(false);
            return;
          }
        }

        // All retries exhausted
        setReconnecting(false);
        if (!cancelledRef.current) {
          onError('Connection lost. Please try again.', false, true);
        }
        setIsStreaming(false);
        setStreamingMsgId(null);
      } finally {
        setReconnecting(false);
      }
    },
    [],
  );

  const cancelStream = useCallback(() => {
    cancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // State cleanup is handled by the catch block in streamChatResponse
  }, []);

  return {
    isStreaming,
    isReconnecting,
    streamingMsgId,
    setStreamingMsgId,
    streamChatResponse,
    cancelStream,
  };
}
