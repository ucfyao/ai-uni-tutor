'use client';

import { BookOpen, Cpu, CreditCard, GraduationCap, Handshake, Mail, Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Accordion,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { PageShell } from '@/components/PageShell';
import { useLanguage } from '@/i18n/LanguageContext';

export default function HelpPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const partnerRef = useRef<HTMLDivElement>(null);
  const [defaultOpenValue, setDefaultOpenValue] = useState<string | undefined>(undefined);

  const faqCategories = [
    {
      id: 'getting-started',
      title: t.help.gettingStarted,
      icon: BookOpen,
      items: [
        { q: t.help.faq.uploadQ, a: t.help.faq.uploadA },
        { q: t.help.faq.startChatQ, a: t.help.faq.startChatA },
        { q: t.help.faq.fileFormatsQ, a: t.help.faq.fileFormatsA },
      ],
    },
    {
      id: 'tutoring-modes',
      title: t.help.tutoringModes,
      icon: GraduationCap,
      items: [
        { q: t.help.faq.modesQ, a: t.help.faq.modesA },
        { q: t.help.faq.switchModeQ, a: t.help.faq.switchModeA },
        { q: t.help.faq.examPrepQ, a: t.help.faq.examPrepA },
      ],
    },
    {
      id: 'account-billing',
      title: t.help.accountBilling,
      icon: CreditCard,
      items: [
        { q: t.help.faq.upgradeQ, a: t.help.faq.upgradeA },
        { q: t.help.faq.manageSubQ, a: t.help.faq.manageSubA },
        { q: t.help.faq.dataPrivacyQ, a: t.help.faq.dataPrivacyA },
      ],
    },
    {
      id: 'partner',
      title: t.help.partnerProgram,
      icon: Handshake,
      items: [
        { q: t.help.faqPartner.whatIsQ, a: t.help.faqPartner.whatIsA },
        { q: t.help.faqPartner.howToApplyQ, a: t.help.faqPartner.howToApplyA },
        { q: t.help.faqPartner.earningsQ, a: t.help.faqPartner.earningsA },
        { q: t.help.faqPartner.payoutQ, a: t.help.faqPartner.payoutA },
        { q: t.help.faqPartner.exclusiveQ, a: t.help.faqPartner.exclusiveA },
      ],
    },
    {
      id: 'technical',
      title: t.help.technical,
      icon: Cpu,
      items: [
        { q: t.help.faq.aiModelQ, a: t.help.faq.aiModelA },
        { q: t.help.faq.usageLimitsQ, a: t.help.faq.usageLimitsA },
        { q: t.help.faq.browsersQ, a: t.help.faq.browsersA },
      ],
    },
  ];

  // Handle ?section=partner — scroll to and auto-open the partner section
  useEffect(() => {
    const section = searchParams.get('section');
    if (section === 'partner') {
      // Auto-open first item in the partner accordion
      setDefaultOpenValue(`${t.help.partnerProgram}-0`);
      // Scroll after a short delay to allow render
      const timer = setTimeout(() => {
        partnerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [searchParams, t.help.partnerProgram]);

  const filteredCategories = faqCategories
    .map((category) => ({
      ...category,
      items: category.items.filter(
        (item) =>
          !search.trim() ||
          item.q.toLowerCase().includes(search.toLowerCase()) ||
          item.a.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((category) => category.items.length > 0);

  return (
    <PageShell title={t.help.title} subtitle={t.help.subtitle}>
      <TextInput
        placeholder={t.help.searchPlaceholder}
        leftSection={<Search size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />

      {filteredCategories.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          {t.help.noResults}
        </Text>
      ) : (
        filteredCategories.map((category) => {
          const Icon = category.icon;
          const isPartner = category.id === 'partner';
          return (
            <Paper
              key={category.title}
              withBorder
              p="xl"
              radius="lg"
              ref={isPartner ? partnerRef : undefined}
            >
              <Stack gap="md">
                <Group gap="sm">
                  <Icon size={20} color="var(--mantine-color-gray-6)" />
                  <Title order={4} fw={700}>
                    {category.title}
                  </Title>
                </Group>
                <Accordion
                  variant="separated"
                  radius="md"
                  defaultValue={isPartner ? defaultOpenValue : undefined}
                >
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
        })
      )}

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
            <Text fz="sm" c="dimmed">
              {t.help.responseTime}
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
