import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Box, Button, Container, Group, SimpleGrid, Text, Title } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

function CountUpStat({ target, suffix, label }: { target: number; suffix: string; label: string }) {
  const [count, setCount] = useState(0);
  const elementRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || hasAnimated.current) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          observer.disconnect();

          if (prefersReducedMotion) {
            setCount(target);
            return;
          }

          const start = performance.now();
          const duration = 2000;
          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <Box ref={elementRef}>
      <Text fz={{ base: '1.875rem', xs: '2.25rem' }} fw={700} c="var(--mantine-color-indigo-6)">
        {count.toLocaleString()}
        {suffix}
      </Text>
      <Text c="dimmed" mt="0.25rem">
        {label}
      </Text>
    </Box>
  );
}

const HeroSection = () => {
  const { t } = useLanguage();

  return (
    <Box
      component="section"
      className="relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-20 pb-24 bg-background"
    >
      {/* Background Effects */}
      <Box className="absolute inset-0 hero-radial" />

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
            style={{ letterSpacing: '-0.03em' }}
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
            <CountUpStat target={50000} suffix="+" label={t.hero.stats.students} />
            <CountUpStat target={98} suffix="%" label={t.hero.stats.satisfaction} />
            <CountUpStat target={200} suffix="+" label={t.hero.stats.subjects} />
          </SimpleGrid>
        </Box>
      </Container>

    </Box>
  );
};

export default HeroSection;
