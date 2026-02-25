import { ArrowUp, Mic, MicOff, Paperclip, Square, Upload } from 'lucide-react';
import React, { useCallback, useEffect, useRef as useReactRef, useState } from 'react';
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
import { notifications } from '@mantine/notifications';
import type { ChatCommand } from '@/constants/commands';
import { filterCommands } from '@/constants/commands';
import { getDocColor, getDocIcon } from '@/constants/doc-types';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useLanguage } from '@/i18n/LanguageContext';
import { ACCEPTED_FILE_TYPES, getFileDisplayName } from '@/lib/file-utils';
import type { TutoringMode } from '@/types';
import { CommandPalette } from './CommandPalette';

const LectureDocIcon = getDocIcon('lecture');

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
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
  attachedDocument?: File | null;
  onRemoveDocument?: () => void;
  mode?: TutoringMode;
  onCommandSelect?: (cmd: ChatCommand) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
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
  attachedDocument,
  onRemoveDocument,
  mode,
  onCommandSelect,
}) => {
  const { t, language } = useLanguage();
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = React.useRef(0);

  // Command palette state
  const [showPalette, setShowPalette] = useState(false);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [filteredCmds, setFilteredCmds] = useState<ChatCommand[]>([]);

  useEffect(() => {
    if (mode && input.startsWith('/')) {
      const matches = filterCommands(input, mode);
      setFilteredCmds(matches);
      setShowPalette(matches.length > 0);
      setPaletteIndex(0);
    } else {
      setShowPalette(false);
    }
  }, [input, mode]);

  // Track the text that was in the input before voice started
  const preVoiceInputRef = useReactRef('');

  const {
    isSupported: isVoiceSupported,
    isListening,
    toggle: toggleVoice,
  } = useSpeechRecognition({
    lang: language === 'zh' ? 'zh-CN' : 'en-US',
    onTranscript: (text) => {
      // Append voice transcript to existing input
      const prefix = preVoiceInputRef.current;
      const separator = prefix && !prefix.endsWith(' ') && !prefix.endsWith('\n') ? ' ' : '';
      setInput(prefix + separator + text);
    },
    onError: (error) => {
      if (error === 'not-allowed') {
        notifications.show({
          title: language === 'zh' ? '麦克风权限被拒绝' : 'Microphone Permission Denied',
          message:
            language === 'zh'
              ? '请在浏览器地址栏旁允许使用麦克风，然后再试一次。'
              : 'Please allow microphone access in your browser settings and try again.',
          color: 'red',
        });
      }
    },
  });

  const handleToggleVoice = useCallback(() => {
    if (!isListening) {
      // Save current input as prefix before starting
      preVoiceInputRef.current = input;
    }
    toggleVoice();
  }, [isListening, input, toggleVoice]);

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

      const files = e.dataTransfer.files;
      if (files.length === 0) return;

      const syntheticEvent = {
        target: { files },
      } as React.ChangeEvent<HTMLInputElement>;
      onFileSelect(syntheticEvent);
    },
    [onFileSelect],
  );

  const handlePaletteSelect = useCallback(
    (cmd: ChatCommand) => {
      setShowPalette(false);
      if (cmd.action === 'send') {
        setInput(cmd.command);
        setTimeout(() => onCommandSelect?.(cmd), 0);
      } else {
        setInput(cmd.command + ' ');
      }
    },
    [setInput, onCommandSelect],
  );

  const handleKeyDownWithPalette = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showPalette && filteredCmds.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setPaletteIndex((prev) => Math.min(prev + 1, filteredCmds.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setPaletteIndex((prev) => Math.max(prev - 1, 0));
          return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handlePaletteSelect(filteredCmds[paletteIndex]);
          return;
        }
        if (e.key === 'Escape') {
          setShowPalette(false);
          return;
        }
      }
      onKeyDown(e);
    },
    [showPalette, filteredCmds, paletteIndex, handlePaletteSelect, onKeyDown],
  );

  return (
    <Container
      size="56.25rem" // 900px, matches MessageList maxWidth
      px="md"
      w="100%"
    >
      <Stack gap={6}>
        {/* Document Preview */}
        {attachedDocument && (
          <Group gap={8} px={4}>
            <Box
              pos="relative"
              className="group/doc"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 8,
                backgroundColor: `light-dark(var(--mantine-color-${getDocColor('lecture')}-0), var(--mantine-color-${getDocColor('lecture')}-9))`,
                border: `1px solid light-dark(var(--mantine-color-${getDocColor('lecture')}-2), var(--mantine-color-${getDocColor('lecture')}-7))`,
              }}
            >
              <LectureDocIcon
                size={14}
                color={`var(--mantine-color-${getDocColor('lecture')}-5)`}
              />
              <Text
                size="xs"
                fw={500}
                c={getDocColor('lecture')}
                style={{ maxWidth: 200 }}
                truncate="end"
              >
                {getFileDisplayName(attachedDocument.name)}
              </Text>
              <CloseButton
                size="xs"
                radius="xl"
                variant="subtle"
                color={getDocColor('lecture')}
                onClick={onRemoveDocument}
              />
            </Box>
          </Group>
        )}

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

        <Box pos="relative">
          {showPalette && (
            <CommandPalette
              commands={filteredCmds}
              selectedIndex={paletteIndex}
              onSelect={handlePaletteSelect}
            />
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
                : 'var(--mantine-color-body)',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 6px rgba(0, 0, 0, 0.04)',
              opacity: isStreaming ? 0.55 : 1,
              pointerEvents: isStreaming ? 'none' : undefined,
              position: 'relative',
            }}
            className="group focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400"
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
                    {t.chat.dropToAttachFiles}
                  </Text>
                </Group>
              </Box>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              multiple
              style={{ display: 'none' }}
              onChange={onFileSelect}
            />

            <Tooltip label={t.chat.attachFiles} position="top" withArrow>
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
                disabled={!!isStreaming || attachedFiles.length >= 4}
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
              onKeyDown={handleKeyDownWithPalette}
              onPaste={onPaste}
              disabled={!!isStreaming}
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
                  backgroundColor: 'transparent',
                  cursor: isStreaming ? 'default' : undefined,
                },
              }}
            />

            {/* Microphone Button */}
            {isVoiceSupported && (
              <Tooltip
                label={isListening ? t.chat.voiceListening : t.chat.voiceInput}
                position="top"
                withArrow
              >
                <ActionIcon
                  variant="subtle"
                  radius="xl"
                  size={32}
                  mr={2}
                  mb={4}
                  onClick={handleToggleVoice}
                  disabled={!!isStreaming}
                  aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                  style={{
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    color: isListening ? 'var(--mantine-color-red-6)' : undefined,
                    animation: isListening ? 'voice-pulse 1.5s ease-in-out infinite' : undefined,
                  }}
                  c={isListening ? 'red' : 'dimmed'}
                  className={isListening ? '' : 'sidebar-hover hover:text-indigo-600'}
                >
                  {isListening ? (
                    <MicOff size={16} strokeWidth={2} />
                  ) : (
                    <Mic size={16} strokeWidth={2} />
                  )}
                </ActionIcon>
              </Tooltip>
            )}

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
                color={
                  input.trim() || attachedFiles.length > 0 || attachedDocument ? 'indigo' : 'gray.4'
                }
                onClick={onSend}
                disabled={
                  (!input.trim() && attachedFiles.length === 0 && !attachedDocument) ||
                  !!isStreaming
                }
                mr={2}
                mb={4}
                className="transition-all duration-200 active:scale-90"
                style={{
                  opacity:
                    !input.trim() && attachedFiles.length === 0 && !attachedDocument ? 0.4 : 1,
                }}
                aria-label="Send message"
              >
                <ArrowUp size={18} strokeWidth={2.5} />
              </ActionIcon>
            )}
          </Box>
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
