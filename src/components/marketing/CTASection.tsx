import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Badge, Box, Button, Container, Text, Title } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const CTASection = () => {
  const { t } = useLanguage();

  return (
    <section className="py-16 md:py-20 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-background to-secondary/20" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[100px]" />

      <Container size="lg" px="md" className="relative z-10">
        <Box className="glass-card max-w-4xl mx-auto p-8 md:p-12 text-center">
          {/* Badge */}
          <Badge
            variant="light"
            size="lg"
            leftSection={<Sparkles className="w-4 h-4" />}
            className="mb-6"
            color="indigo"
          >
            {t.cta.badge}
          </Badge>

          <Title order={2} className="font-display text-4xl md:text-5xl font-bold mb-6">
            {t.cta.title}
            <span className="gradient-text">{t.cta.titleHighlight}</span>
            {t.cta.titleEnd}
          </Title>

          <Text size="xl" c="dimmed" className="max-w-2xl mx-auto mb-8">
            {t.cta.subtitle}
          </Text>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
          </div>

          <Text size="sm" c="dimmed" className="mt-6">
            {t.cta.note}
          </Text>
        </Box>
      </Container>
    </section>
  );
};

export default CTASection;
