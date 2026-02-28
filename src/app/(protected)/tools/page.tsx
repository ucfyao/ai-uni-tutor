'use client';

import { FileSearch, FileText, NotebookPen, Sparkles, Wrench } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const TOOLS_COLOR = 'violet';

export default function ToolsHubPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const tools = [
    {
      key: 'writing',
      label: t.tools.writingAssistant,
      description: t.tools.writingAssistantDesc,
      icon: NotebookPen,
      href: '/tools/writing',
      available: true,
    },
    {
      key: 'reference',
      label: t.tools.quickReference,
      description: t.tools.quickReferenceDesc,
      icon: FileSearch,
      href: null,
      available: false,
    },
    {
      key: 'summary',
      label: t.tools.smartSummary,
      description: t.tools.smartSummaryDesc,
      icon: FileText,
      href: null,
      available: false,
    },
  ];

  return (
    <>
      <Box
        style={{
          position: 'fixed',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100vw',
          height: 240,
          background: `radial-gradient(ellipse at center, var(--mantine-color-${TOOLS_COLOR}-0) 0%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <Container size="lg" py="xl">
        <Stack gap="xl" style={{ position: 'relative', zIndex: 1 }}>
          <Box>
            <Group gap="sm" mb={4}>
              <Wrench size={28} color={`var(--mantine-color-${TOOLS_COLOR}-6)`} />
              <Title order={2} fw={700} style={{ letterSpacing: '-0.02em' }}>
                {t.tools.toolsHub}
              </Title>
            </Group>
          </Box>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Card
                  key={tool.key}
                  withBorder
                  radius="md"
                  p="lg"
                  style={{
                    cursor: tool.available ? 'pointer' : 'default',
                    opacity: tool.available ? 1 : 0.6,
                    transition: 'transform 150ms ease, box-shadow 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    if (tool.available) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = '';
                    e.currentTarget.style.boxShadow = '';
                  }}
                  onClick={() => tool.href && router.push(tool.href)}
                >
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Box
                        p={8}
                        style={{
                          borderRadius: 8,
                          background: `var(--mantine-color-${TOOLS_COLOR}-0)`,
                        }}
                      >
                        <Icon
                          size={24}
                          color={`var(--mantine-color-${TOOLS_COLOR}-6)`}
                          strokeWidth={1.5}
                        />
                      </Box>
                      {!tool.available && (
                        <Badge size="sm" variant="light" color="gray">
                          {t.tools.comingSoon}
                        </Badge>
                      )}
                    </Group>
                    <Box>
                      <Text fw={600} size="lg">
                        {tool.label}
                      </Text>
                      <Text c="dimmed" size="sm" mt={4}>
                        {tool.description}
                      </Text>
                    </Box>
                    {tool.available && (
                      <Button
                        variant="light"
                        color={TOOLS_COLOR}
                        fullWidth
                        leftSection={<Sparkles size={16} />}
                      >
                        {t.tools.launch}
                      </Button>
                    )}
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        </Stack>
      </Container>
    </>
  );
}
