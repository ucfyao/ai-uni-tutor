import { ArrowUp, Paperclip } from 'lucide-react';
import React from 'react';
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
  isKnowledgeMode,
  fileInputRef,
  inputRef,
  onFileSelect,
}) => {
  return (
    <Container
      size={isKnowledgeMode ? '100%' : '56.25rem'} // 900px, matches MessageList maxWidth
      px={isKnowledgeMode ? 'md' : 0}
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
          style={{
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'flex-end',
            border: '1px solid var(--mantine-color-gray-3)',
            backgroundColor: isTyping ? 'var(--mantine-color-gray-1)' : 'rgba(255, 255, 255, 0.92)',
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 6px rgba(0, 0, 0, 0.04)',
            opacity: isTyping ? 0.7 : 1,
            cursor: isTyping ? 'not-allowed' : 'text',
          }}
          className={`group focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 ${
            isTyping ? 'pointer-events-none' : ''
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={onFileSelect}
          />

          <Tooltip label="Attach images" position="top" withArrow>
            <ActionIcon
              variant="subtle"
              c="gray.6"
              radius="xl"
              size={32}
              mb={4}
              ml={2}
              className="hover:bg-gray-100 hover:text-indigo-600 transition-all duration-200"
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
            placeholder="Ask me anything about your course..."
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
                fontSize: '15px',
                color: 'var(--mantine-color-dark-9)',
                lineHeight: 1.5,
              },
            }}
          />

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
        </Box>

        <Group justify="center" gap="xs" visibleFrom="sm" opacity={0.55}>
          <Text size="xs" c="dimmed" fw={500} ta="center">
            AI can make mistakes. Please verify important information.
          </Text>
        </Group>
      </Stack>
    </Container>
  );
};
