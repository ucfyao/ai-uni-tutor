import { useCallback, useRef, useState } from 'react';

const STREAM_TIMEOUT_MS = 60000; // 60 seconds timeout

interface StreamChatOptions {
  course: { code: string; name: string };
  mode: string | null;
  history: { role: string; content: string; images?: { data: string; mimeType: string }[] }[];
  userInput: string;
  images?: { data: string; mimeType: string }[];
}

interface StreamCallbacks {
  onChunk: (text: string) => void;
  onError: (error: string, isLimitError?: boolean, isRetryable?: boolean) => void;
  onComplete: () => void | Promise<void>;
}

export function useChatStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const streamChatResponse = useCallback(
    async (options: StreamChatOptions, callbacks: StreamCallbacks) => {
      const { course, mode, history, userInput, images = [] } = options;
      const { onChunk, onError, onComplete } = callbacks;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

      setIsStreaming(true);

      try {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ course, mode, history, userInput, images }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json();
          onError(errorData.error || 'Failed to generate response', errorData.isLimitError, false);
          setIsStreaming(false);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          onError('Failed to read response stream', false, true);
          setIsStreaming(false);
          return;
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
                return;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  onChunk(parsed.text);
                } else if (parsed.error) {
                  onError(parsed.error, parsed.isLimitError, true);
                  setIsStreaming(false);
                  return;
                }
              } catch {
                // Ignore parse errors for partial chunks
              }
            }
          }
        }

        if (buffer.startsWith('data: ')) {
          const data = buffer.slice(6).trim();
          if (data && data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) onChunk(parsed.text);
              else if (parsed.error) onError(parsed.error, parsed.isLimitError, true);
            } catch {
              // ignore
            }
          }
        }
        await onComplete();
        setIsStreaming(false);
        setStreamingMsgId(null);
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Stream error:', error);

        if (error instanceof Error && error.name === 'AbortError') {
          onError('Request timed out. Please try again.', false, true);
        } else {
          onError('Failed to connect to server. Please check your connection.', false, true);
        }
        setIsStreaming(false);
        setStreamingMsgId(null);
      }
    },
    [],
  );

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setStreamingMsgId(null);
  }, []);

  return {
    isStreaming,
    streamingMsgId,
    setStreamingMsgId,
    streamChatResponse,
    cancelStream,
  };
}
