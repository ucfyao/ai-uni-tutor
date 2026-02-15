'use client';

import { Check, Crown, Sparkles } from 'lucide-react';
import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Group,
  List,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { PageShell } from '@/components/PageShell';
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
    <PageShell title={t.pricing.title} subtitle={t.pricing.subtitle}>
      {/* Billing Toggle */}
      <Box ta="center">
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
        {billing === 'semester' && (
          <Badge color="green" variant="light" size="lg" mt="xs">
            {t.pricing.saveBadge}
          </Badge>
        )}
      </Box>

      {/* Plan Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        {/* Free Card */}
        {!isPro && (
          <Paper withBorder p="xl" radius="lg">
            <Stack gap="lg" justify="space-between" h="100%">
              <Stack gap="lg">
                <Box>
                  <Text fw={700} fz="lg">
                    {t.pricing.free.name}
                  </Text>
                  <Group align="baseline" gap={4} mt={4}>
                    <Text fz={36} fw={800} lh={1}>
                      {t.pricing.free.price}
                    </Text>
                  </Group>
                  <Text size="sm" c="dimmed" mt={4}>
                    {t.pricing.free.period}
                  </Text>
                </Box>

                <List
                  spacing="sm"
                  size="sm"
                  center
                  icon={
                    <ThemeIcon color="gray" size={20} radius="xl" variant="light">
                      <Check size={12} strokeWidth={3} />
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

              <Button fullWidth variant="light" color="gray" radius="md" disabled>
                {t.pricing.free.cta}
              </Button>
            </Stack>
          </Paper>
        )}

        {/* Pro Card */}
        <Paper
          withBorder
          p="xl"
          radius="lg"
          style={{
            borderColor: 'var(--mantine-color-violet-4)',
            borderWidth: 2,
          }}
        >
          <Stack gap="lg" justify="space-between" h="100%">
            <Stack gap="lg">
              <Box>
                <Group gap="xs" mb={4}>
                  <ThemeIcon variant="light" color="violet" size="sm" radius="xl">
                    <Crown size={12} />
                  </ThemeIcon>
                  <Text fw={700} fz="lg">
                    {t.pricing.pro.name}
                  </Text>
                </Group>
                <Group align="baseline" gap={4} mt={4}>
                  <Text fz={36} fw={800} lh={1} c="violet.7">
                    {proPrice}
                  </Text>
                  <Text size="sm" c="dimmed" fw={500}>
                    {proPeriod}
                  </Text>
                </Group>
                {billing === 'semester' && (
                  <Text size="sm" c="dimmed" mt={4}>
                    <Text span td="line-through" c="dimmed">
                      {t.pricing.pro.originalPrice}
                    </Text>
                  </Text>
                )}
              </Box>

              <List
                spacing="sm"
                size="sm"
                center
                icon={
                  <ThemeIcon color="violet" size={20} radius="xl" variant="light">
                    <Check size={12} strokeWidth={3} />
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
              <Button fullWidth variant="light" color="gray" radius="md" disabled>
                {t.pricing.pro.currentPlan}
              </Button>
            ) : (
              <Button
                fullWidth
                color="violet"
                radius="md"
                size="md"
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
    </PageShell>
  );
}
