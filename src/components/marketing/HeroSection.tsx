import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Box, Button, Container, Group, SimpleGrid, Text, Title } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const HeroSection = () => {
  const { t } = useLanguage();

  return (
    <Box
      component="section"
      className="relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-20 pb-24 bg-background"
    >
      {/* Background Effects */}
      <Box className="absolute inset-0 hero-radial" />
      <Box className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pulse-glow" />
      <Box
        className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-accent/10 rounded-full blur-[100px] pulse-glow"
        style={{ animationDelay: '1.5s' }}
      />

      {/* Grid Pattern */}
      <Box className="absolute inset-0 hero-grid" />

      <Container size={1280} px={24} className="relative z-10">
        <Box className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <Box className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/80 border border-border/50 mb-8 animate-fade-in-up opacity-0">
            <Sparkles className="w-4 h-4 text-primary" />
            <Text size="sm" c="dimmed">
              {t.hero.badge}
            </Text>
          </Box>

          {/* Main Heading */}
          <Title
            order={1}
            fz={{ base: '2.25rem', xs: '3rem', sm: '4.5rem' }}
            fw={700}
            lh={1.2}
            mb={{ base: '1.5rem', sm: '2.5rem' }}
            className="animate-fade-in-up opacity-0 animate-delay-100 text-foreground"
          >
            {t.hero.title}
            <br />
            <span className="gradient-text">{t.hero.titleHighlight}</span>
          </Title>

          {/* Subheading */}
          <Text
            fz={{ base: '1.25rem', sm: '1.5rem' }}
            c="dimmed"
            mx="auto"
            mb={{ base: '2.5rem', sm: '3rem' }}
            className="max-w-2xl animate-fade-in-up opacity-0 animate-delay-200"
          >
            {t.hero.subtitle}
          </Text>

          {/* CTA Buttons */}
          <Group
            justify="center"
            gap="md"
            className="animate-fade-in-up opacity-0 animate-delay-300"
          >
            <Button
              className="btn-hero"
              size="xl"
              component={Link}
              href="/login"
              rightSection={<ArrowRight className="w-5 h-5" />}
            >
              {t.hero.cta}
            </Button>
            <Button className="btn-hero-outline" size="xl" component={Link} href="#how-it-works">
              {t.hero.watchDemo}
            </Button>
          </Group>

          {/* Stats */}
          <SimpleGrid
            cols={{ base: 1, xs: 3 }}
            spacing={32}
            pt={{ base: '2rem', sm: '3rem' }}
            mt={{ base: '0.5rem', sm: '1rem' }}
            className="border-t border-border/30 animate-fade-in-up opacity-0 animate-delay-400"
          >
            <Box>
              <Text fz={{ base: '1.875rem', xs: '2.25rem' }} fw={700} className="gradient-text">
                50K+
              </Text>
              <Text c="dimmed" mt="0.25rem">
                {t.hero.stats.students}
              </Text>
            </Box>
            <Box>
              <Text fz={{ base: '1.875rem', xs: '2.25rem' }} fw={700} className="gradient-text">
                98%
              </Text>
              <Text c="dimmed" mt="0.25rem">
                {t.hero.stats.satisfaction}
              </Text>
            </Box>
            <Box>
              <Text fz={{ base: '1.875rem', xs: '2.25rem' }} fw={700} className="gradient-text">
                200+
              </Text>
              <Text c="dimmed" mt="0.25rem">
                {t.hero.stats.subjects}
              </Text>
            </Box>
          </SimpleGrid>
        </Box>
      </Container>

      {/* Scroll Indicator */}
      <Box className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <Box className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
          <Box className="w-1 h-2 bg-muted-foreground/50 rounded-full" />
        </Box>
      </Box>
    </Box>
  );
};

export default HeroSection;
