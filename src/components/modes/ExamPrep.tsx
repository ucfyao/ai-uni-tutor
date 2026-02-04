import React, { useRef, useState } from 'react';
import { Box, Group, Stack } from '@mantine/core';
import { ChatInput } from '@/components/chat/ChatInput';
import { MessageList } from '@/components/chat/MessageList';
import { UsageLimitModal } from '@/components/UsageLimitModal';
import { useChatSession } from '@/hooks/useChatSession';
import { useChatStream } from '@/hooks/useChatStream';
import { showNotification } from '@/lib/notifications';
import { ChatMessage, ChatSession } from '@/types';

interface ExamPrepProps {
  session: ChatSession;
  onUpdateSession: (session: ChatSession) => void;
}

export const ExamPrep: React.FC<ExamPrepProps> = ({ session: initialSession, onUpdateSession }) => {
  const { session, setSession, updateLastMessage, removeLastMessage } = useChatSession({
    initialSession,
    onSessionUpdate: onUpdateSession,
  });

  const { isStreaming, streamingMsgId, setStreamingMsgId, streamChatResponse } = useChatStream();

  const [isLimitModalOpen, setLimitModalOpen] = useState(false);

  // Input state
  const [input, setInput] = useState('');
  const [lastError, setLastError] = useState<{ message: string; canRetry: boolean } | null>(null);
  const [lastInput, setLastInput] = useState('');

  // File upload state
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSendingRef = useRef(false);

  const handleSend = async (retryInput?: string) => {
    const messageToSend = retryInput || input.trim();

    if ((!messageToSend && attachedFiles.length === 0) || isStreaming || isSendingRef.current)
      return;
    if (!session) return;

    isSendingRef.current = true;
    setLastError(null);
    setLastInput(messageToSend);

    // Convert attached files to base64
    const imageData: { data: string; mimeType: string }[] = [];
    for (const file of attachedFiles) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        imageData.push({ data: base64, mimeType: file.type });
      } catch (error) {
        console.error('Failed to process image:', error);
        showNotification({
          title: 'Error',
          message: 'Failed to process image attachment',
          color: 'red',
        });
        isSendingRef.current = false;
        return;
      }
    }

    // Add user message and AI placeholder in one update (avoid stale session: second addMessage would overwrite user msg)
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: messageToSend || '(Image attached)',
      timestamp: Date.now(),
      images: imageData.length > 0 ? imageData : undefined,
    };

    if (!retryInput) {
      setInput('');
      setAttachedFiles([]);
      setImagePreviews([]);
    }

    const aiMsgId = `a_${Date.now()}`;
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    setSession(
      { ...session, messages: [...session.messages, userMsg, aiMsg], lastUpdated: Date.now() },
      { streamingMessageId: aiMsgId },
    );
    setStreamingMsgId(aiMsgId);

    let accumulatedContent = '';

    await streamChatResponse(
      {
        course: session.course,
        mode: session.mode,
        history: session.messages.map((m) => ({
          role: m.role,
          content: m.content,
          images: m.images,
        })),
        userInput: messageToSend,
        images: imageData,
      },
      {
        onChunk: (text) => {
          accumulatedContent += text;
          updateLastMessage(accumulatedContent, aiMsgId);
        },
        onError: (error, isLimitError) => {
          removeLastMessage(); // Remove placeholder
          isSendingRef.current = false;

          if (isLimitError) {
            // Handle limit error - could show upgrade modal
            setLimitModalOpen(true);
          } else {
            setLastError({ message: error, canRetry: true });
            showNotification({ title: 'Error', message: error, color: 'red' });
          }
        },
        onComplete: async () => {
          await updateLastMessage(accumulatedContent, null);
          setLastError(null);
          isSendingRef.current = false;
        },
      },
    );
  };

  const handleRetry = () => {
    if (lastInput) {
      if (session && session.messages.length > 0) {
        removeLastMessage(); // Remove failed user message
      }
      handleSend(lastInput);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      showNotification({
        title: 'Invalid file type',
        message: 'Please select image files only',
        color: 'red',
      });
      return;
    }

    if (attachedFiles.length + imageFiles.length > 4) {
      showNotification({
        title: 'Too many files',
        message: 'You can attach up to 4 images',
        color: 'orange',
      });
      return;
    }

    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviews((prev) => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });

    setAttachedFiles((prev) => [...prev, ...imageFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter((item) => item.type.startsWith('image/'));

    if (imageItems.length === 0) return;

    e.preventDefault();

    imageItems.forEach((item) => {
      const file = item.getAsFile();
      if (!file) return;

      if (attachedFiles.length >= 4) {
        showNotification({
          title: 'Too many files',
          message: 'You can attach up to 4 images',
          color: 'orange',
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviews((prev) => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);

      setAttachedFiles((prev) => [...prev, file]);
    });
  };

  if (!session) return null;

  return (
    <Stack gap={0} h="100%" w="100%" pt={24}>
      <Group
        flex={1}
        gap={0}
        bg="transparent"
        align="stretch"
        style={{ overflow: 'hidden', minHeight: 0 }}
      >
        <Stack gap={0} h="100%" style={{ flex: 1, minWidth: 0 }}>
          <MessageList
            messages={session.messages}
            isTyping={isStreaming}
            streamingMsgId={streamingMsgId}
            lastError={lastError}
            onRetry={handleRetry}
            mode={session.mode}
            isKnowledgeMode={false}
          />

          <Box bg="white" px={0} pb={0} pt={0} style={{ flexShrink: 0, zIndex: 5 }}>
            <ChatInput
              input={input}
              setInput={setInput}
              isTyping={isStreaming}
              onSend={handleSend}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              attachedFiles={attachedFiles}
              imagePreviews={imagePreviews}
              onRemoveFile={handleRemoveFile}
              onFileClick={() => fileInputRef.current?.click()}
              isKnowledgeMode={false}
              fileInputRef={fileInputRef}
              onFileSelect={handleFileSelect}
            />
          </Box>
        </Stack>
      </Group>
      <UsageLimitModal opened={isLimitModalOpen} onClose={() => setLimitModalOpen(false)} />
    </Stack>
  );
};
