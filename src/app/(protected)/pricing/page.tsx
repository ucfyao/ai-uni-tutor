'use client';

import { Check, CreditCard, Sparkles } from 'lucide-react';
import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  List,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';

export default function PricingPage() {
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
      });
      const data = await response.json();
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

  return (
    <Container size="lg" py={80}>
      <Stack align="center" gap="xl" mb={60}>
        <Badge variant="light" color="violet" size="lg">
          {t.pricing.badge}
        </Badge>
        <Title order={1} size={48} fw={900} ta="center">
          {t.pricing.title}
        </Title>
        <Text c="dimmed" size="lg" ta="center" maw={600}>
          {t.pricing.subtitle}
        </Text>
      </Stack>

      <Container size="sm">
        <Card
          withBorder
          radius="xl"
          p="xl"
          style={{
            border: '2px solid var(--mantine-color-violet-2)',
            background: 'linear-gradient(135deg, white 0%, #f5f3ff 100%)',
          }}
        >
          <Stack gap="xl">
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Group gap="xs">
                  <ThemeIcon variant="light" c="violet.9" size="lg" radius="md" color="violet">
                    <Sparkles size={20} />
                  </ThemeIcon>
                  <Title order={2} c="violet.9">
                    {t.pricing.proPlan}
                  </Title>
                </Group>
                <Text size="md" c="gray.6">
                  {t.pricing.proDesc}
                </Text>
              </Stack>
              <Box style={{ textAlign: 'right' }}>
                <Text fz={48} fw={800} c="violet.9" lh={1}>
                  {t.pricing.price}
                </Text>
                <Text size="sm" c="dimmed" fw={600}>
                  {t.pricing.perMonth}
                </Text>
              </Box>
            </Group>

            <List
              spacing="md"
              size="md"
              center
              icon={
                <ThemeIcon color="violet" size={24} radius="xl" variant="light">
                  <Check size={14} strokeWidth={3} />
                </ThemeIcon>
              }
            >
              {t.pricing.features.map((feature, index) => (
                <List.Item key={index}>{feature}</List.Item>
              ))}
            </List>

            <Button
              fullWidth
              size="xl"
              color="violet"
              radius="md"
              onClick={handleUpgrade}
              loading={loading}
              leftSection={<CreditCard size={20} />}
            >
              {t.pricing.getStarted}
            </Button>
            <Text size="xs" c="dimmed" ta="center">
              {t.pricing.securePayment}
            </Text>
          </Stack>
        </Card>
      </Container>
    </Container>
  );
}
