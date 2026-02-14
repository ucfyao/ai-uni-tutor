import { Check, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import React, { useCallback, useState } from 'react';
import {
  ActionIcon,
  Blockquote,
  Box,
  Code,
  Divider,
  Image,
  Paper,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  onLinkClick?: (href: string) => void;
  compact?: boolean;
  /**
   * Tightens vertical rhythm (margins/paddings) without shrinking font sizes.
   * Useful for chat UIs where large markdown spacing feels detached.
   */
  tight?: boolean;
}

const CopyCodeButton: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // Clipboard write failed silently
      });
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

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  onLinkClick,
  compact = false,
  tight = false,
}) => {
  const safeContent = content ?? '';
  const isTightSpacing = compact || tight;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeRaw, rehypeKatex]}
      components={{
        h1: ({ children }) => (
          <Title
            order={2}
            size={compact ? 18 : 24}
            mt={compact ? 14 : isTightSpacing ? 16 : 20}
            mb={compact ? 6 : isTightSpacing ? 8 : 10}
            c="slate.9"
            fw={700}
          >
            {children}
          </Title>
        ),
        h2: ({ children }) => (
          <Title
            order={3}
            size={compact ? 16 : 20}
            mt={compact ? 12 : isTightSpacing ? 14 : 18}
            mb={compact ? 6 : isTightSpacing ? 6 : 8}
            c="slate.9"
            fw={600}
          >
            {children}
          </Title>
        ),
        h3: ({ children }) => (
          <Title
            order={4}
            size={compact ? 15 : 18}
            mt={compact ? 10 : isTightSpacing ? 12 : 16}
            mb={compact ? 4 : isTightSpacing ? 5 : 6}
            c="slate.9"
            fw={600}
          >
            {children}
          </Title>
        ),
        p: ({ children }) => (
          <Text
            size={compact ? 'xs' : 'sm'}
            c="slate.8"
            mb={compact ? 'xs' : isTightSpacing ? 6 : 'sm'}
            style={{ lineHeight: compact ? 1.5 : 1.7, fontSize: compact ? '13px' : '15px' }}
          >
            {children}
          </Text>
        ),
        strong: ({ children }) => (
          <Text span inherit fw={600} c="slate.9">
            {children}
          </Text>
        ),
        em: ({ children }) => (
          <Text span inherit fs="italic" c="slate.8">
            {children}
          </Text>
        ),
        a: ({ href, children }) => (
          <Text
            component="a"
            href={href}
            inherit
            c="indigo.6"
            fw={500}
            className="hover:underline cursor-pointer"
            onClick={(e) => {
              if (onLinkClick && href) {
                e.preventDefault();
                onLinkClick(href);
              }
            }}
          >
            {children}
          </Text>
        ),
        code: ({ className, children }: React.ComponentPropsWithoutRef<'code'>) => {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = !match;
          return isInline ? (
            <Code
              c="slate.9"
              bg="gray.1"
              style={{
                fontWeight: 500,
                fontSize: compact ? '0.85em' : '0.9em',
                padding: '2px 4px',
              }}
            >
              {children}
            </Code>
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
        },
        blockquote: ({ children }) => (
          <Blockquote
            color="gray"
            p={compact ? 'xs' : 'md'}
            mt={isTightSpacing ? 10 : 'sm'}
            mb={isTightSpacing ? 12 : 'md'}
            radius="md"
            bg="gray.0"
            style={{ border: 'none', borderLeft: '4px solid var(--mantine-color-gray-4)' }}
          >
            <Text size={compact ? 'xs' : 'md'} c="slate.7" style={{ lineHeight: 1.75 }}>
              {children}
            </Text>
          </Blockquote>
        ),
        ul: ({ children }) => (
          <ul
            style={{
              paddingLeft: compact ? 18 : 22,
              marginBottom: compact ? 8 : isTightSpacing ? 10 : 12,
            }}
          >
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol
            style={{
              paddingLeft: compact ? 18 : 22,
              marginBottom: compact ? 8 : isTightSpacing ? 10 : 12,
            }}
          >
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li
            style={{
              fontSize: compact ? 13 : 15,
              lineHeight: compact ? '20px' : '24px',
              color: 'var(--mantine-color-slate-7)',
              marginBottom: compact ? 2 : 4,
            }}
          >
            {children}
          </li>
        ),
        hr: () => <Divider my={isTightSpacing ? 'md' : 'xl'} color="slate.2" />,
        img: ({ src, alt }) => (
          <Paper p="xs" withBorder radius="md" my="md">
            <Image src={src} alt={alt} radius="sm" />
            {alt && (
              <Text size="xs" ta="center" c="dimmed" mt="xs">
                {alt}
              </Text>
            )}
          </Paper>
        ),
      }}
    >
      {safeContent}
    </ReactMarkdown>
  );
};

export default React.memo(MarkdownRenderer);
