'use client';

import { Check, GraduationCap, Handshake } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Box,
  Button,
  Group,
  List,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { PageShell } from '@/components/PageShell';
import { useLanguage } from '@/i18n/LanguageContext';

export default function PricingPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const placeholderCourses = [
    { name: 'Course A', price: '--' },
    { name: 'Course B', price: '--' },
  ];

  return (
    <PageShell title={t.pricing.title} subtitle={t.pricing.subtitle}>
      {/* Course Pricing Cards */}
      <Box>
        <Title order={3} fw={700} mb="md">
          {t.pricing.coursePricing}
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          {placeholderCourses.map((course) => (
            <Paper key={course.name} withBorder p="xl" radius="lg">
              <Stack gap="lg">
                <Group justify="space-between" align="flex-start">
                  <Group gap="sm">
                    <ThemeIcon variant="light" color="violet" size="lg" radius="md">
                      <GraduationCap size={20} />
                    </ThemeIcon>
                    <Box>
                      <Text fw={700}>{course.name}</Text>
                      <Text size="xs" c="dimmed">
                        {t.pricing.perCourse}
                      </Text>
                    </Box>
                  </Group>
                  <Badge variant="light" color="gray" size="lg">
                    {t.pricing.comingSoon}
                  </Badge>
                </Group>

                <List
                  spacing="xs"
                  size="sm"
                  center
                  icon={
                    <ThemeIcon color="violet" size={20} radius="xl" variant="light">
                      <Check size={12} strokeWidth={3} />
                    </ThemeIcon>
                  }
                >
                  {t.pricing.courseFeatures.map((feature, index) => (
                    <List.Item key={index}>
                      <Text size="sm" c="dimmed">
                        {feature}
                      </Text>
                    </List.Item>
                  ))}
                </List>

                <Button fullWidth variant="light" color="gray" radius="md" disabled>
                  {t.pricing.getStarted}
                </Button>
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>
      </Box>

      {/* Partner Program Entry */}
      <Paper withBorder p="xl" radius="lg">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <Handshake size={22} color="var(--mantine-color-violet-6)" />
            <Stack gap={4}>
              <Title order={4} fw={700}>
                {t.pricing.partnerSection}
              </Title>
              <Text size="sm" c="dimmed">
                {t.pricing.partnerDesc}
              </Text>
            </Stack>
          </Group>
          <Button
            variant="light"
            color="violet"
            radius="md"
            onClick={() => router.push('/personalization')}
          >
            {t.pricing.learnMore}
          </Button>
        </Group>
      </Paper>

      <Text size="xs" c="dimmed" ta="center">
        {t.pricing.securePayment}
      </Text>
    </PageShell>
  );
}
