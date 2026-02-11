# Chat UX & Visual Polish Upgrade Design

## Overview

Upgrade the chat experience across four modules: message interactions, waiting experience, input optimization, and visual micro-interactions. Goal is to match modern chat UI standards (ChatGPT, Claude.ai) while maintaining the existing glassmorphic design language.

## Module A: Message Interaction Enhancement

### Message Action Bar

Floating action bar at the bottom of each message, visible on hover.

**AI messages:**

- Copy — one-click copy full response (icon changes to checkmark for 1.5s)
- Regenerate — re-request AI answer for the same question, replaces current response
- Thumbs up/down — thumbs down optionally shows feedback input
- Bar style: `opacity: 0` → hover `opacity: 1`, `transition: 0.15s ease`, glassmorphic background

**User messages:**

- Copy
- Edit — message becomes editable textarea, submit re-sends and clears all subsequent messages

### Code Block Copy Button

- Copy button at top-right of every code block
- "Copied!" feedback on click
- Implemented in MarkdownRenderer by wrapping `<pre><code>` with a button container

### Stop Generation Button

- During streaming, replace send button with square stop icon (filled indigo)
- Calls `abortControllerRef.current.abort()`

## Module B: Waiting Experience Upgrade

### Thinking Indicator

Replace current 3-line Skeleton with animated indicator:

- Three bouncing dots (6px circles), staggered 0.15s delay, 0.6s cycle
- Mode-specific text: Lecture Helper → "正在分析概念...", Assignment Coach → "正在梳理思路..."
- Dot color follows mode theme (indigo / violet)

### Streaming Enhancements

- New text fades in with `opacity: 0 → 1`, `0.1s` transition
- Scroll follow changed from `auto` to `smooth`, only when user hasn't scrolled up
- `isUserScrolledUp` detection: `scrollTop + clientHeight < scrollHeight - 100`

### Scroll-to-Bottom Button

- Appears when user scrolls up 200px+
- 40px circle, white glassmorphic, down arrow icon
- Entry animation: `translateY(10px) + opacity: 0` → normal, `0.2s ease`
- Shows dot badge when new AI messages arrive while scrolled up

## Module C: Input Experience Optimization

### Keyboard Shortcuts

- Shift+Enter — newline (with subtle hint text, shown once)
- Escape — clear input content

### Drag-and-Drop Image Upload

- `onDragEnter/Over/Leave/Drop` on ChatInput container
- Drag state: indigo dashed border (`2px dashed`), `indigo.0` background, "松开以添加图片" overlay
- Reuses existing `handleFileSelect` logic
- Non-image files silently ignored
- Transition: `0.15s ease`

### Input Micro-improvements

- Auto-focus on page enter, after send, after AI response completes
- Send button press animation: `scale(0.9) → 1`, `0.15s ease`
- Empty state: rotating placeholder text every 4s with fade transition

## Module D: Visual Micro-interaction Polish

### Message Entry Animations

- User messages: slide in from right `translateX(12px)`, `0.25s ease-out`
- AI messages: slide in from left `translateX(-12px)`, `0.25s ease-out`
- Only for new messages (mark with `isNew` flag), not on history load

### Message Bubble Style Upgrade

- User bubbles: gradient `linear-gradient(135deg, gray-0, gray-1)`, asymmetric border-radius `18px 18px 4px 18px`
- AI messages: 2px indigo left border as visual anchor, fades in `0.3s` after streaming completes

### Timestamps

- Shown on hover alongside action bar, relative format ("刚刚", "3分钟前", "14:30")
- Font: `xs`, color: `dimmed`, synced with action bar opacity animation

### Global Micro-interactions

- Session switch: content area `opacity: 0 → 1`, `0.15s` fade
- Skeleton to content: `0.2s` fade transition
- Scrollbar: `6px` default → `8px` on hover, color `gray-2`, `0.2s` transition

## Affected Files

- `src/components/chat/MessageBubble.tsx`
- `src/components/chat/MessageList.tsx`
- `src/components/chat/ChatInput.tsx`
- `src/components/chat/ChatLayout.tsx`
- `src/components/chat/WelcomeScreen.tsx`
- `src/hooks/useChatStream.ts`
- `src/styles/globals.css` (or equivalent CSS module)
- MarkdownRenderer component (for code block copy)

## Priority Order

A → B → C → D (each module is independently shippable)
