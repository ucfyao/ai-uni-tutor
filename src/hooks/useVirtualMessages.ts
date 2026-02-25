import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, type RefObject } from 'react';
import type { ChatMessage } from '@/types';

const VIRTUAL_THRESHOLD = 50;
const ANIMATION_SAFE_TAIL = 20;
const OVERSCAN = 5;

interface VirtualItem {
  type: 'date-separator' | 'message';
  dateLabel?: string;
  message?: ChatMessage;
  originalIndex?: number;
}

export function useVirtualMessages(
  messages: ChatMessage[],
  dateGroups: Map<number, string>,
  parentRef: RefObject<HTMLDivElement | null>,
) {
  const shouldVirtualize = messages.length > VIRTUAL_THRESHOLD;

  const splitIndex = shouldVirtualize
    ? Math.max(0, messages.length - ANIMATION_SAFE_TAIL)
    : messages.length;

  const { virtualizedMessages, tailMessages } = useMemo(
    () => ({
      virtualizedMessages: shouldVirtualize ? messages.slice(0, splitIndex) : [],
      tailMessages: shouldVirtualize ? messages.slice(splitIndex) : messages,
    }),
    [messages, splitIndex, shouldVirtualize],
  );

  const items = useMemo<VirtualItem[]>(() => {
    const result: VirtualItem[] = [];
    for (let i = 0; i < virtualizedMessages.length; i++) {
      const dateLabel = dateGroups.get(i);
      if (dateLabel) {
        result.push({ type: 'date-separator', dateLabel });
      }
      result.push({ type: 'message', message: virtualizedMessages[i], originalIndex: i });
    }
    return result;
  }, [virtualizedMessages, dateGroups]);

  const estimateSize = useMemo(
    () => (index: number) => (items[index]?.type === 'date-separator' ? 32 : 120),
    [items],
  );

  const virtualizer = useVirtualizer({
    count: shouldVirtualize ? items.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: OVERSCAN,
  });

  return {
    shouldVirtualize,
    items,
    virtualizer,
    tailMessages,
    tailStartIndex: splitIndex,
  };
}
