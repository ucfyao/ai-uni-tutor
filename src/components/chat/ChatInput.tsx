import { ArrowUp, Paperclip, Square, Upload } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import {
  ActionIcon,
  Box,
  CloseButton,
  Container,
  Group,
  Image,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  isTyping: boolean;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  attachedFiles: File[];
  imagePreviews: string[];
  onRemoveFile: (index: number) => void;
  onFileClick: () => void;
  isKnowledgeMode: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStop?: () => void;
  isStreaming?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  isTyping,
  onSend,
  onKeyDown,
  onPaste,
  attachedFiles,
  imagePreviews,
  onRemoveFile,
  onFileClick,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isKnowledgeMode: _isKnowledgeMode,
  fileInputRef,
  inputRef,
  onFileSelect,
  onStop,
  isStreaming,
}) => {
  const { t } = useLanguage();
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

      const dataTransfer = new DataTransfer();
      imageFiles.forEach((f) => dataTransfer.items.add(f));
      const syntheticEvent = {
        target: { files: dataTransfer.files },
      } as React.ChangeEvent<HTMLInputElement>;
      onFileSelect(syntheticEvent);
    },
    [onFileSelect],
  );

  return (
    <Container
      size="56.25rem" // 900px, matches MessageList maxWidth
      px="md"
      w="100%"
    >
      <Stack gap={6}>
        {/* Image Previews */}
        {imagePreviews.length > 0 && (
          <Group gap={8} px={4}>
            {imagePreviews.map((preview, index) => (
              <Box
                key={index}
                pos="relative"
                className="group/img"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid var(--mantine-color-gray-2)',
                }}
              >
                <Image src={preview} alt={`Preview ${index}`} w="100%" h="100%" fit="cover" />
                <Box
                  className="opacity-0 group-hover/img:opacity-100 transition-opacity"
                  pos="absolute"
                  top={2}
                  right={2}
                >
                  <CloseButton
                    size="xs"
                    radius="xl"
                    variant="filled"
                    color="dark"
                    onClick={() => onRemoveFile(index)}
                  />
                </Box>
              </Box>
            ))}
          </Group>
        )}

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
            borderWidth: isDragging ? '2px' : '1px',
            borderStyle: isDragging ? 'dashed' : 'solid',
            borderColor: isDragging
              ? 'var(--mantine-color-indigo-4)'
              : 'var(--mantine-color-default-border)',
            backgroundColor: isDragging
              ? 'var(--mantine-color-indigo-0)'
              : isTyping
                ? 'var(--mantine-color-default-hover)'
                : 'var(--mantine-color-body)',
            transition: 'all 0.15s ease',
            boxShadow: '0 1px 6px rgba(0, 0, 0, 0.04)',
            opacity: isTyping && !isStreaming ? 0.7 : 1,
            cursor: isTyping && !isStreaming ? 'not-allowed' : 'text',
            position: 'relative',
          }}
          className={`group focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 ${
            isTyping && !isStreaming ? 'pointer-events-none' : ''
          }`}
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
                  {t.chat.dropToAttach}
                </Text>
              </Group>
            </Box>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={onFileSelect}
          />

          <Tooltip label={t.chat.attachImages} position="top" withArrow>
            <ActionIcon
              variant="subtle"
              c="dimmed"
              radius="xl"
              size={32}
              mb={4}
              ml={2}
              className="sidebar-hover hover:text-indigo-600"
              aria-label="Attach file"
              onClick={onFileClick}
              disabled={isTyping || attachedFiles.length >= 4}
              style={{
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <Paperclip size={16} strokeWidth={2} />
            </ActionIcon>
          </Tooltip>

          <Textarea
            ref={inputRef}
            autosize
            minRows={1}
            maxRows={8}
            variant="unstyled"
            placeholder={t.chat.typeMessage}
            size="md"
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            disabled={isTyping}
            flex={1}
            px="xs"
            styles={{
              input: {
                paddingTop: '8px',
                paddingBottom: '8px',
                fontWeight: 450,
                fontSize: '16px',
                color: 'var(--mantine-color-text)',
                lineHeight: 1.5,
              },
            }}
          />

          {isStreaming ? (
            <Tooltip label={t.chat.stopGenerating} position="top" withArrow>
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
              className="transition-all duration-200 active:scale-90"
              style={{
                opacity: !input.trim() && attachedFiles.length === 0 ? 0.4 : 1,
              }}
              aria-label="Send message"
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </ActionIcon>
          )}
        </Box>

        <Group justify="center" gap="xs" opacity={0.55} px="xs">
          <Text size="xs" c="dimmed" fw={500} ta="center">
            {t.chat.aiDisclaimer}
          </Text>
        </Group>
      </Stack>
    </Container>
  );
};
