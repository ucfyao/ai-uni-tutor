'use client';

import { ArrowRight, CreditCard, Gauge, Lock, Sparkles, Tag, Upload, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  Accordion,
  Box,
  Button,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { AgentApplicationModal } from '@/components/referral/AgentApplicationModal';
import { LanguageProvider, useLanguage } from '@/i18n/LanguageContext';

// ── Main Page ────────────────────────────────────────────────────────────

function PartnerPageContent({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [modalOpen, setModalOpen] = useState(false);
  const { t } = useLanguage();

  const steps = [
    { icon: Sparkles, title: t.partnerLanding.step1Title, desc: t.partnerLanding.step1Desc },
    { icon: Upload, title: t.partnerLanding.step2Title, desc: t.partnerLanding.step2Desc },
    { icon: Wallet, title: t.partnerLanding.step3Title, desc: t.partnerLanding.step3Desc },
  ];

  const benefits = [
    { icon: Tag, title: t.partnerLanding.why1Title, desc: t.partnerLanding.why1Desc },
    { icon: CreditCard, title: t.partnerLanding.why2Title, desc: t.partnerLanding.why2Desc },
    { icon: Gauge, title: t.partnerLanding.why3Title, desc: t.partnerLanding.why3Desc },
    { icon: Lock, title: t.partnerLanding.why4Title, desc: t.partnerLanding.why4Desc },
  ];

  const faqs = [
    { q: t.help.faqPartner.whatIsQ, a: t.help.faqPartner.whatIsA },
    { q: t.help.faqPartner.howToApplyQ, a: t.help.faqPartner.howToApplyA },
    { q: t.help.faqPartner.earningsQ, a: t.help.faqPartner.earningsA },
    { q: t.help.faqPartner.payoutQ, a: t.help.faqPartner.payoutA },
    { q: t.help.faqPartner.exclusiveQ, a: t.help.faqPartner.exclusiveA },
  ];

  return (
    <Box style={{ minHeight: '100dvh' }}>
      {/* Hero */}
      <Box
        py={{ base: 60, md: 80 }}
        style={{
          background: 'linear-gradient(135deg, #fffbeb 0%, #fff7ed 50%, #fef3c7 100%)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.15)',
        }}
      >
        <Container size={720} px={24}>
          <Stack align="center" gap="md" ta="center">
            <Text fz={48}>💰</Text>
            <Title
              order={1}
              fw={900}
              style={{ fontSize: 'clamp(28px, 4vw, 42px)', letterSpacing: '-0.02em' }}
            >
              {t.partnerLanding.heroTitle}
            </Title>
            <Text c="dimmed" fz="lg" maw={500} lh={1.6}>
              {t.partnerLanding.heroSubtitle}
            </Text>
            {isAuthenticated ? (
              <Button
                size="lg"
                radius="xl"
                color="orange"
                rightSection={<ArrowRight size={18} />}
                mt="sm"
                onClick={() => setModalOpen(true)}
              >
                {t.partnerLanding.applyTitle}
              </Button>
            ) : (
              <Button
                component={Link}
                href="/login?next=/partner"
                size="lg"
                radius="xl"
                color="orange"
                rightSection={<ArrowRight size={18} />}
                mt="sm"
              >
                {t.partnerLanding.loginToApply}
              </Button>
            )}
          </Stack>
        </Container>
      </Box>

      {/* How It Works */}
      <Container size={720} px={24} py={{ base: 40, md: 60 }}>
        <Title order={2} ta="center" mb="xl" fw={800}>
          {t.partnerLanding.howItWorksTitle}
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xl">
          {steps.map((step, i) => (
            <Stack key={step.title} align="center" gap="sm" ta="center">
              <ThemeIcon size={56} radius="xl" variant="light" color="orange">
                <step.icon size={28} />
              </ThemeIcon>
              <Text fz="xs" fw={700} c="orange.6">
                {String(i + 1).padStart(2, '0')}
              </Text>
              <Text fw={700}>{step.title}</Text>
              <Text fz="sm" c="dimmed" lh={1.5}>
                {step.desc}
              </Text>
            </Stack>
          ))}
        </SimpleGrid>
      </Container>

      {/* Why Join */}
      <Box style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
        <Container size={720} px={24} py={{ base: 40, md: 60 }}>
          <Title order={2} ta="center" mb="xl" fw={800}>
            {t.partnerLanding.whyJoinTitle}
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            {benefits.map((b) => (
              <Paper key={b.title} radius="lg" p="lg" withBorder>
                <Group gap="md" wrap="nowrap" align="flex-start">
                  <ThemeIcon size={40} radius="md" variant="light" color="orange">
                    <b.icon size={20} />
                  </ThemeIcon>
                  <Box>
                    <Text fw={700} mb={4}>
                      {b.title}
                    </Text>
                    <Text fz="sm" c="dimmed" lh={1.5}>
                      {b.desc}
                    </Text>
                  </Box>
                </Group>
              </Paper>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* Earnings Example */}
      <Container size={720} px={24} py={{ base: 40, md: 60 }}>
        <Title order={2} ta="center" mb="lg" fw={800}>
          {t.partnerLanding.earningsTitle}
        </Title>
        <Paper
          radius="lg"
          p="xl"
          ta="center"
          style={{
            background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
          }}
        >
          <Text c="dimmed" fz="sm">
            {t.partnerLanding.earningsDesc}
          </Text>
          <Text fw={900} fz={32} c="orange.7" mt="xs">
            {t.partnerLanding.earningsResult}
          </Text>
        </Paper>
      </Container>

      {/* FAQ */}
      <Box style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
        <Container size={720} px={24} py={{ base: 40, md: 60 }}>
          <Title order={2} ta="center" mb="xl" fw={800}>
            {t.partnerLanding.faqTitle}
          </Title>
          <Accordion radius="lg" variant="separated">
            {faqs.map((faq) => (
              <Accordion.Item key={faq.q} value={faq.q}>
                <Accordion.Control>
                  <Text fw={600} fz="sm">
                    {faq.q}
                  </Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Text fz="sm" c="dimmed" lh={1.6}>
                    {faq.a}
                  </Text>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Container>
      </Box>

      {/* Bottom CTA */}
      <Container size={720} px={24} py={{ base: 40, md: 60 }}>
        <Stack align="center" gap="md" ta="center">
          <Title order={2} fw={800}>
            {t.partnerLanding.applyTitle}
          </Title>
          {isAuthenticated ? (
            <Button
              size="lg"
              radius="xl"
              color="orange"
              rightSection={<ArrowRight size={18} />}
              onClick={() => setModalOpen(true)}
            >
              {t.partnerLanding.applyTitle}
            </Button>
          ) : (
            <Button
              component={Link}
              href="/login?next=/partner"
              size="lg"
              radius="xl"
              color="orange"
              rightSection={<ArrowRight size={18} />}
            >
              {t.partnerLanding.loginToApply}
            </Button>
          )}
        </Stack>
      </Container>

      {/* Application Modal */}
      {isAuthenticated && (
        <AgentApplicationModal opened={modalOpen} onClose={() => setModalOpen(false)} />
      )}
    </Box>
  );
}

export function PartnerPageClient({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <LanguageProvider>
      <PartnerPageContent isAuthenticated={isAuthenticated} />
    </LanguageProvider>
  );
}
