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
import { showNotification } from '@/lib/notifications';

export default function PricingPage() {
  // const router = useRouter(); // Unused
  const [loading, setLoading] = useState(false);

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
        title: 'Error',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message: (error as any).message || 'An error occurred',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const features = [
    'Unlimited document uploads',
    'Advanced RAG with hybrid search',
    'Higher rate limits',
    'Priority support',
    'Early access to new features',
  ];

  return (
    <Container size="lg" py={80}>
      <Stack align="center" gap="xl" mb={60}>
        <Badge variant="light" color="violet" size="lg">
          Pricing
        </Badge>
        <Title order={1} size={48} fw={900} ta="center">
          Simple, transparent pricing
        </Title>
        <Text c="dimmed" size="lg" ta="center" maw={600}>
          Choose the plan that&apos;s right for you. Upgrade anytime to unlock the full potential of
          your AI Tutor.
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
                    Pro Plan
                  </Title>
                </Group>
                <Text size="md" c="gray.6">
                  Everything you need to excel.
                </Text>
              </Stack>
              <Box style={{ textAlign: 'right' }}>
                <Text fz={48} fw={800} c="violet.9" lh={1}>
                  $9.99
                </Text>
                <Text size="sm" c="dimmed" fw={600}>
                  per month
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
              {features.map((feature, index) => (
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
              Get Started
            </Button>
            <Text size="xs" c="dimmed" ta="center">
              Secure payment via Stripe. Cancel anytime.
            </Text>
          </Stack>
        </Card>
      </Container>
    </Container>
  );
}

// Helper Box component already imported
