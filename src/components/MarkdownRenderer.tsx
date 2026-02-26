import { Check, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon,
  Blockquote,
  Box,
  Code,
  Divider,
  Group,
  Image,
  Paper,
  ScrollArea,
  Text,
  Title,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';
import type { HighlightResult } from '@/lib/shiki';
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

const CopyCodeButton: React.FC<{ code: string; t: { copyCode: string; copied: string } }> = ({
  code,
  t,
}) => {
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
    <Tooltip label={copied ? t.copied : t.copyCode} position="left" withArrow>
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

const ShikiCodeBlock: React.FC<{
  code: string;
  language: string;
  compact: boolean;
  isTightSpacing: boolean;
  t: { copyCode: string; copied: string };
}> = ({ code, language, compact, isTightSpacing, t }) => {
  const { colorScheme } = useMantineColorScheme();
  const [result, setResult] = useState<HighlightResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    const theme = colorScheme === 'dark' ? 'github-dark' : 'github-light';
    import('@/lib/shiki')
      .then(({ highlightCode }) =>
        highlightCode(code, language, theme).then((r) => {
          if (!cancelled) setResult(r);
        }),
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code, language, colorScheme]);

  return (
    <Box pos="relative" className="group/code" my={isTightSpacing ? 'sm' : 'md'}>
      <Paper
        p={0}
        bg="var(--mantine-color-default-hover)"
        withBorder
        radius="md"
        style={{ overflow: 'hidden' }}
      >
        <Group
          justify="space-between"
          px={compact ? 'sm' : 'md'}
          py={4}
          style={{
            borderBottom: '1px solid var(--mantine-color-default-border)',
            background: 'var(--mantine-color-default)',
          }}
        >
          <Text size="xs" c="dimmed" fw={500} tt="uppercase">
            {language}
          </Text>
        </Group>

        <ScrollArea type="auto">
          <Box
            p={compact ? 'sm' : 'md'}
            style={{ fontSize: compact ? '13px' : '14px', lineHeight: '1.6' }}
          >
            {result ? (
              <pre style={{ margin: 0, background: 'transparent' }}>
                <code>
                  {result.tokens.map((line, i) => (
                    <span key={i}>
                      {line.map((token, j) => (
                        <span key={j} style={{ color: token.color }}>
                          {token.content}
                        </span>
                      ))}
                      {i < result.tokens.length - 1 && '\n'}
                    </span>
                  ))}
                </code>
              </pre>
            ) : (
              <Code
                block
                bg="transparent"
                style={{ fontSize: compact ? '13px' : '14px', lineHeight: '1.6' }}
              >
                {code}
              </Code>
            )}
          </Box>
        </ScrollArea>
      </Paper>
      <CopyCodeButton code={code} t={t} />
    </Box>
  );
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  onLinkClick,
  compact = false,
  tight = false,
}) => {
  const { t } = useLanguage();
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
            fw={600}
          >
            {children}
          </Title>
        ),
        p: ({ children }) => (
          <Text
            size={compact ? 'xs' : 'sm'}
            mb={compact ? 'xs' : isTightSpacing ? 6 : 'sm'}
            style={{ lineHeight: compact ? 1.5 : 1.7, fontSize: compact ? '13px' : '16px' }}
          >
            {children}
          </Text>
        ),
        strong: ({ children }) => (
          <Text span inherit fw={600}>
            {children}
          </Text>
        ),
        em: ({ children }) => (
          <Text span inherit fs="italic">
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
          const codeString = String(children).replace(/\n$/, '');

          if (!match) {
            return (
              <Code
                bg="var(--mantine-color-default-hover)"
                style={{
                  fontWeight: 500,
                  fontSize: compact ? '0.85em' : '0.9em',
                  padding: '2px 4px',
                }}
              >
                {children}
              </Code>
            );
          }

          return (
            <ShikiCodeBlock
              code={codeString}
              language={match[1]}
              compact={compact}
              isTightSpacing={isTightSpacing}
              t={t.chat}
            />
          );
        },
        table: ({ children }: React.ComponentPropsWithoutRef<'table'>) => (
          <Paper
            withBorder
            radius="md"
            my={isTightSpacing ? 'sm' : 'md'}
            style={{ overflow: 'hidden' }}
          >
            <ScrollArea type="auto">
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: compact ? '13px' : '14px',
                }}
              >
                {children}
              </table>
            </ScrollArea>
          </Paper>
        ),
        thead: ({ children }: React.ComponentPropsWithoutRef<'thead'>) => (
          <thead
            style={{
              background: 'var(--mantine-color-default)',
              borderBottom: '2px solid var(--mantine-color-default-border)',
            }}
          >
            {children}
          </thead>
        ),
        tbody: ({ children }: React.ComponentPropsWithoutRef<'tbody'>) => <tbody>{children}</tbody>,
        tr: ({ children, ...props }: React.ComponentPropsWithoutRef<'tr'>) => (
          <tr
            {...props}
            style={{
              borderBottom: '1px solid var(--mantine-color-default-border)',
              transition: 'background 0.1s ease',
            }}
            className="hover:bg-[var(--mantine-color-default-hover)]"
          >
            {children}
          </tr>
        ),
        th: ({ children }: React.ComponentPropsWithoutRef<'th'>) => (
          <th
            style={{
              padding: compact ? '6px 10px' : '8px 14px',
              textAlign: 'left',
              fontWeight: 600,
              fontSize: compact ? '12px' : '13px',
              color: 'var(--mantine-color-text)',
              whiteSpace: 'nowrap',
            }}
          >
            {children}
          </th>
        ),
        td: ({ children }: React.ComponentPropsWithoutRef<'td'>) => (
          <td
            style={{
              padding: compact ? '6px 10px' : '8px 14px',
              fontSize: compact ? '13px' : '14px',
              color: 'var(--mantine-color-text)',
              wordBreak: 'break-word',
            }}
          >
            {children}
          </td>
        ),
        blockquote: ({ children }) => (
          <Blockquote
            color="gray"
            p={compact ? 'xs' : 'md'}
            mt={isTightSpacing ? 10 : 'sm'}
            mb={isTightSpacing ? 12 : 'md'}
            radius="md"
            className="bg-surface-subtle"
            style={{ border: 'none', borderLeft: '4px solid var(--mantine-color-gray-4)' }}
          >
            <Text size={compact ? 'xs' : 'md'} c="dimmed" style={{ lineHeight: 1.75 }}>
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
              fontSize: compact ? 13 : 16,
              lineHeight: compact ? '20px' : '24px',
              color: 'var(--mantine-color-text)',
              marginBottom: compact ? 2 : 4,
            }}
          >
            {children}
          </li>
        ),
        hr: () => <Divider my={isTightSpacing ? 'md' : 'xl'} />,
        // Suppress browser warning for unknown <card> tags from AI responses
        ...({
          card: ({ children }: { children?: React.ReactNode }) => (
            <span style={{ display: 'block' }}>{children}</span>
          ),
        } as Record<string, React.ComponentType<{ children?: React.ReactNode }>>),
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
