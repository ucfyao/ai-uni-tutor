'use client';

import { BookOpen, Cpu, CreditCard, GraduationCap, Mail } from 'lucide-react';
import { Accordion, Group, Paper, Stack, Text, Title, UnstyledButton } from '@mantine/core';
import { PageShell } from '@/components/PageShell';
import { useLanguage } from '@/i18n/LanguageContext';

export default function HelpPage() {
  const { t } = useLanguage();

  const faqCategories = [
    {
      title: t.help.gettingStarted,
      icon: BookOpen,
      items: [
        { q: t.help.faq.uploadQ, a: t.help.faq.uploadA },
        { q: t.help.faq.startChatQ, a: t.help.faq.startChatA },
        { q: t.help.faq.fileFormatsQ, a: t.help.faq.fileFormatsA },
      ],
    },
    {
      title: t.help.tutoringModes,
      icon: GraduationCap,
      items: [
        { q: t.help.faq.modesQ, a: t.help.faq.modesA },
        { q: t.help.faq.switchModeQ, a: t.help.faq.switchModeA },
        { q: t.help.faq.examPrepQ, a: t.help.faq.examPrepA },
      ],
    },
    {
      title: t.help.accountBilling,
      icon: CreditCard,
      items: [
        { q: t.help.faq.upgradeQ, a: t.help.faq.upgradeA },
        { q: t.help.faq.manageSubQ, a: t.help.faq.manageSubA },
        { q: t.help.faq.dataPrivacyQ, a: t.help.faq.dataPrivacyA },
      ],
    },
    {
      title: t.help.technical,
      icon: Cpu,
      items: [
        { q: t.help.faq.aiModelQ, a: t.help.faq.aiModelA },
        { q: t.help.faq.usageLimitsQ, a: t.help.faq.usageLimitsA },
        { q: t.help.faq.browsersQ, a: t.help.faq.browsersA },
      ],
    },
  ];

  return (
    <PageShell title={t.help.title} subtitle={t.help.subtitle}>
      {faqCategories.map((category) => {
        const Icon = category.icon;
        return (
          <Paper key={category.title} withBorder p="xl" radius="lg">
            <Stack gap="md">
              <Group gap="sm">
                <Icon size={20} color="var(--mantine-color-gray-6)" />
                <Title order={4} fw={700}>
                  {category.title}
                </Title>
              </Group>
              <Accordion variant="separated" radius="md">
                {category.items.map((item, index) => (
                  <Accordion.Item key={index} value={`${category.title}-${index}`}>
                    <Accordion.Control>
                      <Text size="sm" fw={500}>
                        {item.q}
                      </Text>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Text size="sm" c="dimmed" lh={1.6}>
                        {item.a}
                      </Text>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            </Stack>
          </Paper>
        );
      })}

      {/* Contact Support */}
      <Paper withBorder p="xl" radius="lg">
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Title order={4} fw={700}>
              {t.help.contactTitle}
            </Title>
            <Text size="sm" c="dimmed">
              {t.help.contactDesc}
            </Text>
          </Stack>
          <UnstyledButton
            component="a"
            href="mailto:support@aiunitutor.com"
            py={8}
            px={16}
            style={{
              borderRadius: 8,
              border: '1px solid var(--mantine-color-gray-3)',
            }}
          >
            <Group gap={8}>
              <Mail size={16} color="var(--mantine-color-gray-6)" />
              <Text size="sm" fw={500}>
                {t.help.contactEmail}
              </Text>
            </Group>
          </UnstyledButton>
        </Group>
      </Paper>
    </PageShell>
  );
}
