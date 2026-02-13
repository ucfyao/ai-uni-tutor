import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Box, Button, Container, Flex, Text, Title } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const CTASection = () => {
  const { t } = useLanguage();

  return (
    <Box component="section" className="py-16 md:py-24 relative overflow-hidden">
      {/* Background Effects */}
      <Box className="absolute inset-0 bg-gradient-to-b from-background to-secondary/20" />
      <Box className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[100px]" />

      <Container size={1280} px={24} className="relative z-10">
        <Box className="glass-card max-w-5xl mx-auto p-5 sm:p-8 md:p-14 text-center">
          {/* Badge */}
          <Box className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <Text size="sm" c="var(--mantine-color-indigo-6)">
              {t.cta.badge}
            </Text>
          </Box>

          <Title order={2} fz={{ base: '2.25rem', sm: '3rem' }} fw={700} mb="1.5rem">
            {t.cta.title}
            <span className="gradient-text">{t.cta.titleHighlight}</span>
            {t.cta.titleEnd}
          </Title>

          <Text fz="1.25rem" c="dimmed" mx="auto" mb="2rem" className="max-w-2xl">
            {t.cta.subtitle}
          </Text>

          <Flex
            direction={{ base: 'column', sm: 'row' }}
            align="center"
            justify="center"
            gap="md"
            wrap="wrap"
          >
            <Button
              className="btn-hero"
              size="xl"
              component={Link}
              href="/login"
              rightSection={<ArrowRight className="w-5 h-5" />}
            >
              {t.cta.startTrial}
            </Button>
            <Button
              className="btn-hero-outline"
              size="xl"
              component="a"
              href="mailto:ucfyao@gmail.com"
            >
              {t.cta.contactUs}
            </Button>
          </Flex>

          <Text size="sm" c="dimmed" mt="1.5rem">
            {t.cta.note}
          </Text>
        </Box>
      </Container>
    </Box>
  );
};

export default CTASection;
