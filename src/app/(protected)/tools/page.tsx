'use client';

import { BookOpen, FileText, Lock, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, Group, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import { PageShell } from '@/components/PageShell';
import { useLanguage } from '@/i18n/LanguageContext';

interface ToolCard {
  key: string;
  icon: typeof FileText;
  color: string;
  titleKey: 'writingAssistant' | 'quickReference' | 'smartSummary';
  descKey: 'writingAssistantDesc' | 'quickReferenceDesc' | 'smartSummaryDesc';
  href?: string;
  comingSoon?: boolean;
}

const tools: ToolCard[] = [
  {
    key: 'writing-assistant',
    icon: FileText,
    color: 'indigo',
    titleKey: 'writingAssistant',
    descKey: 'writingAssistantDesc',
    href: '/tools/writing-assistant',
  },
  {
    key: 'quick-reference',
    icon: BookOpen,
    color: 'teal',
    titleKey: 'quickReference',
    descKey: 'quickReferenceDesc',
    comingSoon: true,
  },
  {
    key: 'smart-summary',
    icon: Sparkles,
    color: 'orange',
    titleKey: 'smartSummary',
    descKey: 'smartSummaryDesc',
    comingSoon: true,
  },
];

export default function ToolsHubPage() {
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <PageShell title={t.tools.toolsHub}>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Card
              key={tool.key}
              withBorder
              radius="lg"
              padding="xl"
              style={{
                opacity: tool.comingSoon ? 0.6 : 1,
                cursor: tool.comingSoon ? 'default' : 'pointer',
              }}
              onClick={tool.href ? () => router.push(tool.href!) : undefined}
            >
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <ThemeIcon size={48} radius="md" variant="light" color={tool.color}>
                    <Icon size={24} />
                  </ThemeIcon>
                  {tool.comingSoon && (
                    <Badge variant="light" color="gray" leftSection={<Lock size={12} />}>
                      {t.tools.comingSoon}
                    </Badge>
                  )}
                </Group>
                <Stack gap={4}>
                  <Text fw={600} size="lg">
                    {t.tools[tool.titleKey]}
                  </Text>
                  <Text size="sm" c="dimmed" lh={1.5}>
                    {t.tools[tool.descKey]}
                  </Text>
                </Stack>
                {!tool.comingSoon && (
                  <Button
                    variant="light"
                    color={tool.color}
                    fullWidth
                    onClick={(e) => {
                      e.stopPropagation();
                      if (tool.href) router.push(tool.href);
                    }}
                  >
                    {t.tools.launch}
                  </Button>
                )}
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>
    </PageShell>
  );
}
