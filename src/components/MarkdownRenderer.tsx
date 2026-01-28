import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Title, Text, Code, Paper, Blockquote, List, Box, Divider, Image } from '@mantine/core';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeRaw, rehypeKatex]}
      components={{
        h1: ({ children }) => <Title order={2} size={24} mt={32} mb={16} c="slate.9" fw={700}>{children}</Title>,
        h2: ({ children }) => <Title order={3} size={20} mt={24} mb={12} c="slate.9" fw={600}>{children}</Title>,
        h3: ({ children }) => <Title order={4} size={18} mt={20} mb={8} c="slate.9" fw={600}>{children}</Title>,
        p: ({ children }) => <Text size="md" c="slate.8" mb="sm" style={{ lineHeight: 1.75 }}>{children}</Text>,
        strong: ({ children }) => <Text span fw={600} c="slate.9">{children}</Text>,
        em: ({ children }) => <Text span fs="italic" c="slate.8">{children}</Text>,
        code: ({ className, children }: React.ComponentPropsWithoutRef<'code'>) => {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = !match;
          return isInline ? (
            <Code c="slate.9" bg="gray.1" style={{ fontWeight: 500, fontSize: '0.9em', padding: '2px 4px' }}>{children}</Code>
          ) : (
             <Paper p="md" bg="slate.0" withBorder radius="md" my="md" style={{ overflow: 'auto' }}>
              <Code block c="slate.9" bg="transparent" style={{ fontSize: '14px', lineHeight: '1.6' }}>{children}</Code>
             </Paper>
          );
        },
        blockquote: ({ children }) => (
          <Blockquote color="gray" p="md" mt="sm" mb="md" radius="md" bg="gray.0" style={{ border: 'none', borderLeft: '4px solid var(--mantine-color-gray-4)' }}>
             <Text size="md" c="slate.7" style={{ lineHeight: 1.75 }}>{children}</Text>
          </Blockquote>
        ),
        ul: ({ children }) => <List spacing="xs" size="md" mb="md" center icon={<Box w={6} h={6} bg="slate.5" style={{ borderRadius: '50%', marginTop: '8px' }} />}>{children}</List>,
        ol: ({ children }) => <List type="ordered" spacing="xs" size="md" mb="md" center>{children}</List>,
        li: ({ children }) => <List.Item style={{ fontSize: '16px', lineHeight: '28px', color: 'var(--mantine-color-slate-7)' }}>{children}</List.Item>,
        hr: () => <Divider my="xl" color="slate.2" />,
        img: ({ src, alt }) => (
           <Paper p="xs" withBorder radius="md" my="md">
             <Image src={src} alt={alt} radius="sm" />
             {alt && <Text size="xs" ta="center" c="dimmed" mt="xs">{alt}</Text>}
           </Paper>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export default MarkdownRenderer;
