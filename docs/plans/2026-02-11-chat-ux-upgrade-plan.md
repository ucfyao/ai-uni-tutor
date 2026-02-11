# Chat UX & Visual Polish Upgrade — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade chat experience with message actions, improved waiting UX, input enhancements, and visual micro-interactions.

**Architecture:** All changes are in the chat component layer (`src/components/chat/`) and hooks (`src/hooks/`). The main chat logic lives in `LectureHelper.tsx` which directly renders `MessageList`, `ChatInput`, and `KnowledgePanel` (it does NOT use `ChatLayout.tsx`). `AssignmentCoach` is an alias re-export of `LectureHelper`. Message state is managed by `useChatSession` hook, streaming by `useChatStream` hook.

**Tech Stack:** Next.js 16, React 19, Mantine v8, Lucide React icons, TypeScript 5.9, Tailwind CSS v4

**Key files:**

- `src/components/chat/MessageBubble.tsx` — Individual message rendering
- `src/components/chat/MessageList.tsx` — Message list with scroll, loading, error states
- `src/components/chat/ChatInput.tsx` — Input area (textarea, file attach, send button)
- `src/components/MarkdownRenderer.tsx` — Markdown rendering with code blocks
- `src/components/modes/LectureHelper.tsx` — Main chat page wiring all components
- `src/hooks/useChatStream.ts` — Streaming state management
- `src/hooks/useChatSession.ts` — Session/message state management
- `src/app/globals.css` — Global animations and CSS

---

## Task 1: Code Block Copy Button

Add a copy button to every code block in MarkdownRenderer.

**Files:**

- Modify: `src/components/MarkdownRenderer.tsx:107-141` (code component)
- Modify: `src/app/globals.css` (add copy button styles)

**Step 1: Add copy button to code block rendering**

In `src/components/MarkdownRenderer.tsx`, replace the code block branch (the `else` branch inside the `code` component, lines 122-140) with a wrapper that includes a copy button:

```tsx
// Add to imports at top of file
import { Check, Copy } from 'lucide-react'; // new import

import { useCallback, useState } from 'react'; // new import
import { ActionIcon, Tooltip } from '@mantine/core'; // add ActionIcon, Tooltip to existing import
```

Replace the code block rendering (lines 122-140):

```tsx
) : (
  <Box pos="relative" className="group/code" my={isTightSpacing ? 'sm' : 'md'}>
    <Paper
      p={compact ? 'sm' : 'md'}
      bg="slate.0"
      withBorder
      radius="md"
      style={{ overflow: 'auto' }}
    >
      <Code
        block
        c="slate.9"
        bg="transparent"
        style={{ fontSize: compact ? '13px' : '14px', lineHeight: '1.6' }}
      >
        {children}
      </Code>
    </Paper>
    <CopyCodeButton code={String(children).replace(/\n$/, '')} />
  </Box>
);
```

**Step 2: Create CopyCodeButton component above MarkdownRenderer**

Add this above the `MarkdownRenderer` component definition:

```tsx
const CopyCodeButton: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);

  return (
    <Tooltip label={copied ? 'Copied!' : 'Copy code'} position="left" withArrow>
      <ActionIcon
        variant="subtle"
        color={copied ? 'teal' : 'gray'}
        size={28}
        radius="md"
        onClick={handleCopy}
        className="code-copy-btn"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          opacity: copied ? 1 : 0,
          transition: 'opacity 0.15s ease',
        }}
        aria-label="Copy code"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </ActionIcon>
    </Tooltip>
  );
};
```

**Step 3: Add CSS for hover reveal**

In `src/app/globals.css`, add:

```css
/* Code block copy button - show on hover */
.group\/code:hover .code-copy-btn {
  opacity: 1 !important;
}
```

**Step 4: Verify**

Run: `npx vitest run`
Expected: All 33 tests pass (no test changes needed — this is pure UI).

**Step 5: Commit**

```bash
git add src/components/MarkdownRenderer.tsx src/app/globals.css
git commit -m "feat(chat): add copy button to code blocks"
```

---

## Task 2: Message Action Bar

Add action buttons (copy, regenerate, thumbs up/down) below each message.

**Files:**

- Modify: `src/components/chat/MessageBubble.tsx` — Add action bar
- Modify: `src/components/chat/MessageList.tsx` — Pass new callbacks
- Modify: `src/components/modes/LectureHelper.tsx` — Implement onRegenerate
- Modify: `src/app/globals.css` — Action bar animations

**Step 1: Update MessageBubbleProps interface**

In `MessageBubble.tsx`, add to the `MessageBubbleProps` interface (after line 39):

```tsx
onRegenerate?: (messageId: string) => void;
onCopyMessage?: (content: string) => void;
```

Destructure them in the component (add after `onAddCard`):

```tsx
onRegenerate,
```

**Step 2: Add action bar after the message content**

In `MessageBubble.tsx`, add the MessageActionBar component above the MessageBubble component:

```tsx
const MessageActionBar: React.FC<{
  isUser: boolean;
  content: string;
  messageId: string;
  onRegenerate?: (messageId: string) => void;
}> = ({ isUser, content, messageId, onRegenerate }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [content]);

  return (
    <Group
      gap={2}
      mt={6}
      className="message-actions"
      style={{ opacity: 0, transition: 'opacity 0.15s ease' }}
    >
      <Tooltip label={copied ? 'Copied!' : 'Copy'} position="bottom" withArrow>
        <ActionIcon
          variant="subtle"
          color={copied ? 'teal' : 'gray'}
          size={28}
          radius="md"
          onClick={handleCopy}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </ActionIcon>
      </Tooltip>

      {!isUser && onRegenerate && (
        <Tooltip label="Regenerate" position="bottom" withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            size={28}
            radius="md"
            onClick={() => onRegenerate(messageId)}
          >
            <RefreshCw size={14} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
};
```

Add necessary imports at the top of `MessageBubble.tsx`:

```tsx
import { Check, Copy, Quote, RefreshCw } from 'lucide-react';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Image,
  Portal,
  SimpleGrid,
  Text,
  Tooltip,
} from '@mantine/core';
```

**Step 3: Render the action bar inside the message bubble**

In `MessageBubble.tsx`, insert the action bar after the `</Box>` that wraps `markdown-content` (after line 308), but before the selection toolbar:

```tsx
{
  /* Message Action Bar */
}
{
  !isStreaming && (
    <MessageActionBar
      isUser={isUser}
      content={message.content}
      messageId={message.id}
      onRegenerate={onRegenerate}
    />
  );
}
```

**Step 4: Add hover reveal CSS**

In `src/app/globals.css`:

```css
/* Message action bar - show on hover */
[data-message-bubble]:hover .message-actions {
  opacity: 1 !important;
}
```

Add `data-message-bubble` attribute to the outer `<Box>` in MessageBubble (the one at line 230):

```tsx
<Box
  data-message-bubble
  style={{
```

**Step 5: Wire up onRegenerate in MessageList**

In `MessageList.tsx`, add to `MessageListProps` interface:

```tsx
onRegenerate?: (messageId: string) => void;
```

Destructure it and pass to `MessageBubble`:

```tsx
<MessageBubble
  message={{ ...msg, content: displayText }}
  isStreaming={msg.id === streamingMsgId}
  onStreamingComplete={() => {}}
  mode={mode}
  knowledgeCards={knowledgeCards}
  onHighlightClick={onHighlightClick}
  onAddCard={onAddCard}
  onRegenerate={onRegenerate}
/>
```

**Step 6: Implement onRegenerate in LectureHelper**

In `LectureHelper.tsx`, add the handler after `handleRetry` (around line 322):

```tsx
const handleRegenerate = async (messageId: string) => {
  if (!session || isStreaming) return;

  // Find the assistant message and the user message before it
  const msgIndex = session.messages.findIndex((m) => m.id === messageId);
  if (msgIndex < 1) return;

  const userMsg = session.messages[msgIndex - 1];
  if (userMsg.role !== 'user') return;

  // Remove from the user message onwards
  const messagesToRemove = session.messages.length - msgIndex + 1;
  removeMessages(messagesToRemove);

  // Re-send with the original user input
  handleSend(userMsg.content);
};
```

Pass it to `MessageList`:

```tsx
<MessageList
  ...existing props...
  onRegenerate={handleRegenerate}
/>
```

**Step 7: Verify and commit**

Run: `npx vitest run`
Expected: All tests pass.

```bash
git add src/components/chat/MessageBubble.tsx src/components/chat/MessageList.tsx src/components/modes/LectureHelper.tsx src/app/globals.css
git commit -m "feat(chat): add message action bar with copy and regenerate"
```

---

## Task 3: Stop Generation Button

Replace the send button with a stop button during streaming.

**Files:**

- Modify: `src/components/chat/ChatInput.tsx` — Conditional stop/send button
- Modify: `src/components/modes/LectureHelper.tsx` — Pass cancelStream

**Step 1: Update ChatInputProps**

In `ChatInput.tsx`, add to `ChatInputProps`:

```tsx
onStop?: () => void;
isStreaming?: boolean;
```

Destructure them in the component.

**Step 2: Replace the send button with conditional rendering**

Replace the send `ActionIcon` (lines 166-182) with:

```tsx
{
  isStreaming ? (
    <Tooltip label="Stop generating" position="top" withArrow>
      <ActionIcon
        size={32}
        radius="xl"
        variant="filled"
        color="gray.7"
        onClick={onStop}
        mr={2}
        mb={4}
        className="transition-all duration-200"
        aria-label="Stop generating"
      >
        <Square size={14} fill="currentColor" />
      </ActionIcon>
    </Tooltip>
  ) : (
    <ActionIcon
      size={32}
      radius="xl"
      variant="filled"
      color={input.trim() || attachedFiles.length > 0 ? 'indigo' : 'gray.4'}
      onClick={onSend}
      disabled={(!input.trim() && attachedFiles.length === 0) || isTyping}
      mr={2}
      mb={4}
      className="transition-all duration-200"
      style={{
        opacity: !input.trim() && attachedFiles.length === 0 ? 0.4 : 1,
      }}
      aria-label="Send message"
    >
      <ArrowUp size={18} strokeWidth={2.5} />
    </ActionIcon>
  );
}
```

Add `Square` to the lucide-react import and `Tooltip` to the Mantine import.

**Step 3: Pass cancelStream from LectureHelper**

In `LectureHelper.tsx`, destructure `cancelStream` from `useChatStream()`:

```tsx
const { isStreaming, streamingMsgId, setStreamingMsgId, streamChatResponse, cancelStream } =
  useChatStream();
```

Pass to ChatInput:

```tsx
<ChatInput
  ...existing props...
  onStop={cancelStream}
  isStreaming={isStreaming}
/>
```

**Step 4: Verify and commit**

Run: `npx vitest run`

```bash
git add src/components/chat/ChatInput.tsx src/components/modes/LectureHelper.tsx
git commit -m "feat(chat): add stop generation button during streaming"
```

---

## Task 4: Thinking Indicator

Replace skeleton loading with animated bouncing dots.

**Files:**

- Create: `src/components/chat/ThinkingIndicator.tsx`
- Modify: `src/components/chat/MessageList.tsx` — Use new indicator
- Modify: `src/app/globals.css` — Bounce animation

**Step 1: Create ThinkingIndicator component**

Create `src/components/chat/ThinkingIndicator.tsx`:

```tsx
import React from 'react';
import { Box, Group, Text } from '@mantine/core';
import { TutoringMode } from '@/types';

const THINKING_TEXT: Record<string, string> = {
  'Lecture Helper': '正在分析概念...',
  'Assignment Coach': '正在梳理思路...',
};

interface ThinkingIndicatorProps {
  mode?: TutoringMode | null;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ mode }) => {
  const text = (mode && THINKING_TEXT[mode]) || '正在思考...';
  const color =
    mode === 'Assignment Coach' ? 'var(--mantine-color-violet-5)' : 'var(--mantine-color-indigo-5)';

  return (
    <Group gap="sm" py={4}>
      <Group gap={4}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: color,
              animation: `thinkingBounce 0.6s ease-in-out infinite`,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </Group>
      <Text size="sm" c="dimmed" fw={500}>
        {text}
      </Text>
    </Group>
  );
};
```

**Step 2: Add bounce keyframes**

In `src/app/globals.css`:

```css
/* Thinking indicator bounce */
@keyframes thinkingBounce {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  50% {
    transform: translateY(-6px);
    opacity: 1;
  }
}
```

**Step 3: Replace skeleton in MessageList**

In `MessageList.tsx`, replace the loading state (lines 116-127):

```tsx
{
  /* Loading state */
}
{
  isTyping && streamingMsgId === null && <ThinkingIndicator mode={mode} />;
}
```

Add import:

```tsx
import { ThinkingIndicator } from './ThinkingIndicator';
```

Remove unused imports: `Avatar`, `Skeleton` (and `Bot` from lucide if only used there).

**Step 4: Verify and commit**

Run: `npx vitest run`

```bash
git add src/components/chat/ThinkingIndicator.tsx src/components/chat/MessageList.tsx src/app/globals.css
git commit -m "feat(chat): replace skeleton with animated thinking indicator"
```

---

## Task 5: Scroll-to-Bottom Button

Show a floating button when user scrolls up, with new message indicator.

**Files:**

- Modify: `src/components/chat/MessageList.tsx` — Add scroll tracking and button
- Modify: `src/app/globals.css` — Button animation

**Step 1: Add scroll state tracking**

In `MessageList.tsx`, add state and scroll handler:

```tsx
import { ArrowDown } from 'lucide-react'; // add to lucide import
import { useCallback, useEffect, useRef, useState } from 'react'; // update import

import { ActionIcon } from '@mantine/core'; // add to mantine import
```

Inside the component, after the viewport ref:

```tsx
const [isScrolledUp, setIsScrolledUp] = useState(false);
const [hasNewMessage, setHasNewMessage] = useState(false);
const prevMessageCountRef = useRef(mainMessages.length);

const handleScroll = useCallback(() => {
  if (!viewport.current) return;
  const { scrollTop, scrollHeight, clientHeight } = viewport.current;
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
  setIsScrolledUp(distanceFromBottom > 200);
}, []);

const scrollToBottom = useCallback(() => {
  if (viewport.current) {
    viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
  }
  setHasNewMessage(false);
}, []);
```

**Step 2: Update auto-scroll logic**

Replace the existing auto-scroll useEffect (lines 57-65):

```tsx
useEffect(() => {
  if (isScrolledUp) {
    // Don't auto-scroll if user scrolled up; show indicator instead
    if (mainMessages.length > prevMessageCountRef.current) {
      setHasNewMessage(true);
    }
  } else {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (viewport.current) {
          viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
        }
      }),
    );
    return () => cancelAnimationFrame(id);
  }
  prevMessageCountRef.current = mainMessages.length;
}, [messages, isTyping, isScrolledUp, mainMessages.length]);
```

**Step 3: Attach scroll listener to ScrollArea**

On the `ScrollArea` component, add `onScrollPositionChange`:

```tsx
<ScrollArea
  viewportRef={viewport}
  h="100%"
  scrollbarSize={8}
  type="auto"
  onScrollPositionChange={handleScroll}
>
```

**Step 4: Add the floating button**

Inside the main `return`, wrap `ScrollArea` in a `Box pos="relative"` and add the button after `ScrollArea`:

```tsx
<Box bg="white" style={{ flex: 1, minHeight: 0 }} pos="relative">
  <ScrollArea ...>
    ...existing content...
  </ScrollArea>

  {/* Scroll to bottom button */}
  {isScrolledUp && (
    <ActionIcon
      variant="white"
      size={40}
      radius="xl"
      onClick={scrollToBottom}
      pos="absolute"
      bottom={16}
      right={16}
      style={{
        zIndex: 10,
        backgroundColor: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--mantine-color-gray-2)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        animation: 'scrollBtnIn 0.2s ease-out',
      }}
      aria-label="Scroll to bottom"
    >
      <Box pos="relative">
        <ArrowDown size={18} color="var(--mantine-color-gray-7)" />
        {hasNewMessage && (
          <Box
            pos="absolute"
            top={-3}
            right={-3}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: 'var(--mantine-color-indigo-5)',
            }}
          />
        )}
      </Box>
    </ActionIcon>
  )}
</Box>
```

**Step 5: Add CSS animation**

In `src/app/globals.css`:

```css
/* Scroll to bottom button entrance */
@keyframes scrollBtnIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**Step 6: Verify and commit**

Run: `npx vitest run`

```bash
git add src/components/chat/MessageList.tsx src/app/globals.css
git commit -m "feat(chat): add scroll-to-bottom button with new message indicator"
```

---

## Task 6: Drag-and-Drop Image Upload

Add drag-and-drop support to the chat input area.

**Files:**

- Modify: `src/components/chat/ChatInput.tsx` — Add drag state and handlers

**Step 1: Add drag state and handlers**

In `ChatInput.tsx`, convert to using state for drag:

```tsx
import { Upload } from 'lucide-react'; // add to lucide imports
import React, { useCallback, useState } from 'react'; // update import
```

Add inside the component, before the return:

```tsx
const [isDragging, setIsDragging] = useState(false);
const dragCounterRef = React.useRef(0);

const handleDragEnter = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounterRef.current++;
  if (e.dataTransfer.types.includes('Files')) {
    setIsDragging(true);
  }
}, []);

const handleDragLeave = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounterRef.current--;
  if (dragCounterRef.current === 0) {
    setIsDragging(false);
  }
}, []);

const handleDragOver = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
}, []);

const handleDrop = useCallback(
  (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    // Create a synthetic event to reuse existing handler
    const dataTransfer = new DataTransfer();
    imageFiles.forEach((f) => dataTransfer.items.add(f));
    const syntheticEvent = {
      target: { files: dataTransfer.files },
    } as React.ChangeEvent<HTMLInputElement>;
    onFileSelect(syntheticEvent);
  },
  [onFileSelect],
);
```

**Step 2: Apply drag handlers and visual state to the input container**

On the main input `Box` (the one with `borderRadius: '20px'`), add:

```tsx
<Box
  p={4}
  onDragEnter={handleDragEnter}
  onDragLeave={handleDragLeave}
  onDragOver={handleDragOver}
  onDrop={handleDrop}
  style={{
    borderRadius: '20px',
    display: 'flex',
    alignItems: 'flex-end',
    border: isDragging
      ? '2px dashed var(--mantine-color-indigo-4)'
      : '1px solid var(--mantine-color-gray-3)',
    backgroundColor: isDragging
      ? 'var(--mantine-color-indigo-0)'
      : isTyping
        ? 'var(--mantine-color-gray-1)'
        : 'rgba(255, 255, 255, 0.92)',
    transition: 'all 0.15s ease',
    boxShadow: '0 1px 6px rgba(0, 0, 0, 0.04)',
    opacity: isTyping ? 0.7 : 1,
    cursor: isTyping ? 'not-allowed' : 'text',
    position: 'relative',
  }}
  ...rest of existing props
>
  {/* Drag overlay */}
  {isDragging && (
    <Box
      pos="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '20px',
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      <Group gap={6}>
        <Upload size={16} color="var(--mantine-color-indigo-5)" />
        <Text size="sm" c="indigo.5" fw={500}>
          松开以添加图片
        </Text>
      </Group>
    </Box>
  )}

  ...existing children (file input, attach button, textarea, send button)
</Box>
```

**Step 3: Verify and commit**

Run: `npx vitest run`

```bash
git add src/components/chat/ChatInput.tsx
git commit -m "feat(chat): add drag-and-drop image upload"
```

---

## Task 7: Send Button Press Animation & Auto-Focus

Small input UX improvements.

**Files:**

- Modify: `src/components/chat/ChatInput.tsx` — Animation + auto-focus
- Modify: `src/components/modes/LectureHelper.tsx` — Focus after streaming

**Step 1: Add press animation to send button**

In `ChatInput.tsx`, add a CSS class for the send button press:

```tsx
className = 'transition-all duration-200 active:scale-90';
```

Apply it to the send `ActionIcon`.

**Step 2: Auto-focus after AI response**

In `LectureHelper.tsx`, in the `onComplete` callback of `streamChatResponse` (around line 213), add:

```tsx
onComplete: async () => {
  await updateLastMessage(accumulatedContent, null);
  setLastError(null);
  isSendingRef.current = false;
  requestAnimationFrame(() => chatInputRef.current?.focus());
},
```

**Step 3: Verify and commit**

Run: `npx vitest run`

```bash
git add src/components/chat/ChatInput.tsx src/components/modes/LectureHelper.tsx
git commit -m "feat(chat): add send button animation and auto-focus after response"
```

---

## Task 8: Message Entry Animations

Add slide-in animations for new messages.

**Files:**

- Modify: `src/components/chat/MessageList.tsx` — Track new messages, add animation classes
- Modify: `src/app/globals.css` — Entry animation keyframes

**Step 1: Track new message IDs**

In `MessageList.tsx`, add a ref to track which messages are "new" (appeared after initial render):

```tsx
const initialMsgIdsRef = useRef<Set<string>>(new Set(mainMessages.map((m) => m.id)));
const [animatedIds, setAnimatedIds] = useState<Set<string>>(new Set());

useEffect(() => {
  const newIds = mainMessages
    .filter((m) => !initialMsgIdsRef.current.has(m.id) && !animatedIds.has(m.id))
    .map((m) => m.id);

  if (newIds.length > 0) {
    setAnimatedIds((prev) => {
      const next = new Set(prev);
      newIds.forEach((id) => next.add(id));
      return next;
    });
  }
}, [mainMessages, animatedIds]);
```

**Step 2: Apply animation class to new messages**

In the message rendering loop, update the wrapper `Box`:

```tsx
<Box
  key={msg.id}
  style={{
    display: 'flex',
    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
  }}
  className={
    animatedIds.has(msg.id)
      ? msg.role === 'user'
        ? 'msg-enter-right'
        : 'msg-enter-left'
      : undefined
  }
>
```

**Step 3: Add keyframes**

In `src/app/globals.css`:

```css
/* Message entry animations */
@keyframes msgEnterLeft {
  from {
    opacity: 0;
    transform: translateX(-12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes msgEnterRight {
  from {
    opacity: 0;
    transform: translateX(12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.msg-enter-left {
  animation: msgEnterLeft 0.25s ease-out;
}

.msg-enter-right {
  animation: msgEnterRight 0.25s ease-out;
}
```

**Step 4: Verify and commit**

Run: `npx vitest run`

```bash
git add src/components/chat/MessageList.tsx src/app/globals.css
git commit -m "feat(chat): add message entry slide animations"
```

---

## Task 9: Message Bubble Style Upgrade

Polish bubble styles: user gradient, AI left border, asymmetric radius.

**Files:**

- Modify: `src/components/chat/MessageBubble.tsx` — Updated styles

**Step 1: Update user message bubble**

In `MessageBubble.tsx`, update the inner `Box` styles (around line 241):

```tsx
style={{
  borderRadius: isUser ? '18px 18px 4px 18px' : '16px',
  background: isUser
    ? 'linear-gradient(135deg, var(--mantine-color-gray-0), var(--mantine-color-gray-1))'
    : 'transparent',
  border: isUser ? '1px solid var(--mantine-color-gray-2)' : 'none',
  borderLeft: !isUser && !isStreaming ? '2px solid var(--mantine-color-indigo-3)' : !isUser ? '2px solid transparent' : undefined,
  boxShadow: isUser ? '0 1px 6px rgba(0, 0, 0, 0.03)' : 'none',
  color: isUser ? 'var(--mantine-color-dark-9)' : 'inherit',
  position: 'relative',
  transition: 'border-color 0.3s ease',
}}
```

**Step 2: Verify and commit**

Run: `npx vitest run`

```bash
git add src/components/chat/MessageBubble.tsx
git commit -m "feat(chat): upgrade message bubble styles with gradient and accent border"
```

---

## Task 10: Timestamps on Hover

Show relative timestamps alongside the action bar.

**Files:**

- Modify: `src/components/chat/MessageBubble.tsx` — Add timestamp display

**Step 1: Add relative time helper**

Add above the `MessageBubble` component:

```tsx
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;

  const date = new Date(timestamp);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}
```

**Step 2: Show timestamp in action bar**

In the `MessageActionBar` component, add a timestamp parameter and render it:

```tsx
const MessageActionBar: React.FC<{
  isUser: boolean;
  content: string;
  messageId: string;
  timestamp: number;
  onRegenerate?: (messageId: string) => void;
}> = ({ isUser, content, messageId, timestamp, onRegenerate }) => {
```

Add at the end of the `Group`, before closing `</Group>`:

```tsx
<Text size="xs" c="dimmed" ml={4}>
  {formatRelativeTime(timestamp)}
</Text>
```

Pass `timestamp` where `MessageActionBar` is rendered:

```tsx
<MessageActionBar
  isUser={isUser}
  content={message.content}
  messageId={message.id}
  timestamp={message.timestamp}
  onRegenerate={onRegenerate}
/>
```

**Step 3: Verify and commit**

Run: `npx vitest run`

```bash
git add src/components/chat/MessageBubble.tsx
git commit -m "feat(chat): show relative timestamps on message hover"
```

---

## Task 11: Session Switch Fade Transition

Add a brief fade when switching between chat sessions.

**Files:**

- Modify: `src/components/modes/LectureHelper.tsx` — Add transition wrapper

**Step 1: Add fade transition on session change**

In `LectureHelper.tsx`, add state for transition:

```tsx
import { Transition } from '@mantine/core'; // add to existing mantine import

const [mounted, setMounted] = useState(true);
const prevSessionIdRef = useRef(session?.id);

React.useEffect(() => {
  if (session?.id !== prevSessionIdRef.current) {
    setMounted(false);
    const timer = setTimeout(() => {
      setMounted(true);
      prevSessionIdRef.current = session?.id;
    }, 50);
    return () => clearTimeout(timer);
  }
}, [session?.id]);
```

Wrap the main content area with a transition:

```tsx
<Box style={{ flex: 1, minWidth: 0, minHeight: 0, opacity: mounted ? 1 : 0, transition: 'opacity 0.15s ease' }}>
  <MessageList ... />
  <Box ...input area... />
</Box>
```

**Step 2: Verify and commit**

Run: `npx vitest run`

```bash
git add src/components/modes/LectureHelper.tsx
git commit -m "feat(chat): add fade transition on session switch"
```

---

## Task 12: Scrollbar Polish

Refine scrollbar appearance.

**Files:**

- Modify: `src/app/globals.css` — Scrollbar styles

**Step 1: Add scrollbar styles**

In `src/app/globals.css`:

```css
/* Polished scrollbar */
.mantine-ScrollArea-scrollbar {
  transition:
    opacity 0.2s ease,
    width 0.2s ease !important;
}

.mantine-ScrollArea-scrollbar[data-orientation='vertical'] {
  width: 6px !important;
}

.mantine-ScrollArea-scrollbar[data-orientation='vertical']:hover {
  width: 8px !important;
}

.mantine-ScrollArea-thumb {
  background-color: var(--mantine-color-gray-3) !important;
  border-radius: 99px !important;
}
```

**Step 2: Update ScrollArea scrollbarSize in MessageList**

In `MessageList.tsx`, change `scrollbarSize={8}` to `scrollbarSize={6}`.

**Step 3: Verify and commit**

Run: `npx vitest run`

```bash
git add src/app/globals.css src/components/chat/MessageList.tsx
git commit -m "style(chat): polish scrollbar appearance"
```

---

## Summary

| Task | Description                           | Files Modified                                         |
| ---- | ------------------------------------- | ------------------------------------------------------ |
| 1    | Code block copy button                | MarkdownRenderer, globals.css                          |
| 2    | Message action bar (copy, regenerate) | MessageBubble, MessageList, LectureHelper, globals.css |
| 3    | Stop generation button                | ChatInput, LectureHelper                               |
| 4    | Thinking indicator                    | ThinkingIndicator (new), MessageList, globals.css      |
| 5    | Scroll-to-bottom button               | MessageList, globals.css                               |
| 6    | Drag-and-drop image upload            | ChatInput                                              |
| 7    | Send button animation & auto-focus    | ChatInput, LectureHelper                               |
| 8    | Message entry animations              | MessageList, globals.css                               |
| 9    | Message bubble style upgrade          | MessageBubble                                          |
| 10   | Timestamps on hover                   | MessageBubble                                          |
| 11   | Session switch fade                   | LectureHelper                                          |
| 12   | Scrollbar polish                      | globals.css, MessageList                               |

Each task is independently committable. Tasks 1-5 cover the highest-impact changes (Module A + B). Tasks 6-7 cover Module C. Tasks 8-12 cover Module D.
