import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import React from 'react';
import { Blockquote, Box, Code, Divider, Image, List, Paper, Text, Title } from '@mantine/core';

interface MarkdownRendererProps {
  content: string;
  onLinkClick?: (href: string) => void;
  compact?: boolean;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  onLinkClick,
  compact = false,
}) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeRaw, rehypeKatex]}
      components={{
        h1: ({ children }) => (
          <Title
            order={2}
            size={compact ? 20 : 32}
            mt={compact ? 16 : 32}
            mb={compact ? 8 : 16}
            c="slate.9"
            fw={700}
          >
            {children}
          </Title>
        ),
        h2: ({ children }) => (
          <Title
            order={3}
            size={compact ? 18 : 26}
            mt={compact ? 12 : 24}
            mb={compact ? 6 : 12}
            c="slate.9"
            fw={600}
          >
            {children}
          </Title>
        ),
        h3: ({ children }) => (
          <Title
            order={4}
            size={compact ? 16 : 22}
            mt={compact ? 10 : 20}
            mb={compact ? 4 : 8}
            c="slate.9"
            fw={600}
          >
            {children}
          </Title>
        ),
        p: ({ children }) => (
          <Text
            size={compact ? 'xs' : 'xl'}
            c="slate.8"
            mb={compact ? 'xs' : 'sm'}
            style={{ lineHeight: compact ? 1.5 : 1.8, fontSize: compact ? '13px' : '18px' }}
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
            <Paper p="md" bg="slate.0" withBorder radius="md" my="md" style={{ overflow: 'auto' }}>
              <Code
                block
                c="slate.9"
                bg="transparent"
                style={{ fontSize: compact ? '13px' : '16px', lineHeight: '1.6' }}
              >
                {children}
              </Code>
            </Paper>
          );
        },
        blockquote: ({ children }) => (
          <Blockquote
            color="gray"
            p={compact ? 'xs' : 'md'}
            mt="sm"
            mb="md"
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
          <List
            spacing="xs"
            size={compact ? 'sm' : 'md'}
            mb="md"
            center
            icon={
              <Box w={6} h={6} bg="slate.5" style={{ borderRadius: '50%', marginTop: '8px' }} />
            }
          >
            {children}
          </List>
        ),
        ol: ({ children }) => (
          <List type="ordered" spacing="xs" size={compact ? 'sm' : 'md'} mb="md" center>
            {children}
          </List>
        ),
        li: ({ children }) => (
          <List.Item
            style={{
              fontSize: compact ? '13px' : '18px',
              lineHeight: compact ? '20px' : '30px',
              color: 'var(--mantine-color-slate-7)',
            }}
          >
            {children}
          </List.Item>
        ),
        hr: () => <Divider my="xl" color="slate.2" />,
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
      {content}
    </ReactMarkdown>
  );
};

export default MarkdownRenderer;
