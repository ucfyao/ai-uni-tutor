'use client';

import { Check, Crown, Sparkles } from 'lucide-react';
import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Container,
  Group,
  List,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { useProfile } from '@/context/ProfileContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';

type BillingCycle = 'monthly' | 'semester';

export default function PricingPage() {
  const { t } = useLanguage();
  const { profile } = useProfile();
  const [billing, setBilling] = useState<BillingCycle>('monthly');
  const [loading, setLoading] = useState(false);

  const isPro =
    profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: billing }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error) {
      showNotification({
        title: t.pricing.errorTitle,
        message: error instanceof Error ? error.message : 'An error occurred',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const proPrice =
    billing === 'semester' ? t.pricing.pro.priceSemester : t.pricing.pro.priceMonthly;
  const proPeriod =
    billing === 'semester' ? t.pricing.pro.periodSemester : t.pricing.pro.periodMonthly;

  return (
    <Container size={700} py={60}>
      <Stack gap={40}>
        {/* Header */}
        <Stack align="center" gap="md">
          <Badge
            variant="light"
            color="violet"
            size="lg"
            radius="xl"
            leftSection={<Sparkles size={14} />}
          >
            {t.pricing.title}
          </Badge>

          {/* Billing Toggle */}
          <SegmentedControl
            value={billing}
            onChange={(v) => setBilling(v as BillingCycle)}
            data={[
              { label: t.pricing.monthly, value: 'monthly' },
              { label: t.pricing.semester, value: 'semester' },
            ]}
            radius="xl"
            size="md"
          />
          {billing === 'semester' ? (
            <Badge color="green" variant="light" size="md">
              {t.pricing.saveBadge}
            </Badge>
          ) : (
            <Text size="xs" c="dimmed">
              {t.pricing.semesterHint}
            </Text>
          )}
        </Stack>

        {/* Plan Cards */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
          {/* Free Card */}
          {!isPro && (
            <Paper withBorder p={32} radius="lg">
              <Stack gap="xl" justify="space-between" h="100%">
                <Stack gap="xl">
                  <Box>
                    <Text fw={700} fz="xl">
                      {t.pricing.free.name}
                    </Text>
                    <Group align="baseline" gap={6} mt="sm">
                      <Text fz={44} fw={800} lh={1}>
                        {t.pricing.free.price}
                      </Text>
                    </Group>
                    <Text size="sm" c="dimmed" mt="xs">
                      {t.pricing.free.period}
                    </Text>
                  </Box>

                  <List
                    spacing="md"
                    size="sm"
                    center
                    icon={
                      <ThemeIcon color="gray" size={22} radius="xl" variant="light">
                        <Check size={13} strokeWidth={3} />
                      </ThemeIcon>
                    }
                  >
                    {t.pricing.free.features.map((feature, i) => (
                      <List.Item key={i}>
                        <Text size="sm">{feature}</Text>
                      </List.Item>
                    ))}
                  </List>
                </Stack>

                <Button fullWidth variant="light" color="gray" radius="md" size="md" disabled>
                  {t.pricing.free.cta}
                </Button>
              </Stack>
            </Paper>
          )}

          {/* Pro Card */}
          <Paper
            withBorder
            p={32}
            radius="lg"
            style={{
              borderColor: 'var(--mantine-color-violet-4)',
              borderWidth: 2,
            }}
          >
            <Stack gap="xl" justify="space-between" h="100%">
              <Stack gap="xl">
                <Box>
                  <Group gap="xs" mb="xs">
                    <ThemeIcon variant="light" color="violet" size={28} radius="xl">
                      <Crown size={14} />
                    </ThemeIcon>
                    <Text fw={700} fz="xl">
                      {t.pricing.pro.name}
                    </Text>
                  </Group>
                  <Group align="baseline" gap={6} mt="sm" wrap="nowrap">
                    <Text fz={44} fw={800} lh={1} c="violet.7">
                      {proPrice}
                    </Text>
                    <Text size="sm" c="dimmed" fw={500}>
                      {proPeriod}
                    </Text>
                    {billing === 'semester' && (
                      <Text size="sm" td="line-through" c="dimmed" fw={400}>
                        {t.pricing.pro.originalPrice}
                      </Text>
                    )}
                  </Group>
                </Box>

                <List
                  spacing="md"
                  size="sm"
                  center
                  icon={
                    <ThemeIcon color="violet" size={22} radius="xl" variant="light">
                      <Check size={13} strokeWidth={3} />
                    </ThemeIcon>
                  }
                >
                  {t.pricing.pro.features.map((feature, i) => (
                    <List.Item key={i}>
                      <Text size="sm">{feature}</Text>
                    </List.Item>
                  ))}
                </List>
              </Stack>

              {isPro ? (
                <Button fullWidth variant="light" color="gray" radius="md" size="md" disabled>
                  {t.pricing.pro.currentPlan}
                </Button>
              ) : (
                <Button
                  fullWidth
                  color="violet"
                  radius="md"
                  size="lg"
                  onClick={handleUpgrade}
                  loading={loading}
                  leftSection={<Sparkles size={18} />}
                >
                  {t.pricing.pro.cta}
                </Button>
              )}
            </Stack>
          </Paper>
        </SimpleGrid>

        {/* Footer */}
        <Text size="xs" c="dimmed" ta="center">
          {t.pricing.securePayment}
        </Text>
      </Stack>
    </Container>
  );
}
