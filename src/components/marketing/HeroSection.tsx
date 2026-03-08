import { ArrowRight, BookOpen, Sparkles, Star, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

type StatIcon = typeof Users;

function CountUpStat({
  target,
  suffix,
  label,
  icon: Icon,
  color,
}: {
  target: number;
  suffix: string;
  label: string;
  icon: StatIcon;
  color: string;
}) {
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
    <Stack ref={elementRef} align="center" gap={8}>
      <ThemeIcon size={40} radius="xl" variant="light" color={color}>
        <Icon size={20} strokeWidth={2} />
      </ThemeIcon>
      <Text fz={{ base: '1.875rem', xs: '2.25rem' }} fw={700} lh={1} c={`${color}.6`}>
        {count.toLocaleString()}
        {suffix}
      </Text>
      <Text c="dimmed" mt="0.25rem">
        {label}
      </Text>
    </Stack>
  );
}

const HeroSection = () => {
  const { t } = useLanguage();

  return (
    <Box
      component="section"
      className="hero-radial relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-20 pb-24"
      style={{ background: 'var(--gradient-hero)' }}
    >
      {/* Background grid pattern */}
      <Box className="absolute inset-0 hero-grid" />

      {/* Subtle ambient glow */}
      <Box
        aria-hidden
        style={{
          position: 'absolute',
          top: '-20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80%',
          maxWidth: 600,
          height: '40%',
          background:
            'radial-gradient(ellipse at center, hsl(var(--primary) / 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <Container size={1280} px={24} style={{ position: 'relative', zIndex: 1 }}>
        <Box className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <Box
            mb={32}
            style={{
              animation: 'study-subtitle-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
            }}
          >
            <Badge
              variant="light"
              color="indigo"
              size="lg"
              radius="xl"
              leftSection={<Sparkles size={14} />}
            >
              {t.hero.badge}
            </Badge>
          </Box>

          {/* Main Heading */}
          <Title
            order={1}
            fz={{ base: '2.25rem', xs: '3rem', sm: '4.5rem' }}
            fw={700}
            lh={1.2}
            mb={{ base: '1.5rem', sm: '2.5rem' }}
            style={{
              animation: 'study-title-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both',
            }}
          >
            {t.hero.title}
            <br />
            <Text component="span" c="indigo.6" inherit>
              {t.hero.titleHighlight}
            </Text>
          </Title>

          {/* Subheading */}
          <Text
            fz={{ base: '1.25rem', sm: '1.5rem' }}
            c="dimmed"
            mx="auto"
            mb={{ base: '2.5rem', sm: '3rem' }}
            className="max-w-2xl"
            style={{
              animation: 'study-subtitle-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both',
            }}
          >
            {t.hero.subtitle}
          </Text>

          {/* CTA Buttons */}
          <Group
            justify="center"
            gap="md"
            style={{
              animation: 'study-subtitle-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.2s both',
            }}
          >
            <Button
              size="xl"
              color="indigo"
              component={Link}
              href="/login"
              rightSection={<ArrowRight size={20} />}
            >
              {t.hero.cta}
            </Button>
            <Button size="xl" variant="light" color="indigo" component={Link} href="#how-it-works">
              {t.hero.watchDemo}
            </Button>
          </Group>
        </Box>

        {/* Stats */}
        <SimpleGrid
          cols={{ base: 3 }}
          spacing={{ base: 'md', sm: 32 }}
          mt={{ base: 56, sm: 72 }}
          maw={720}
          mx="auto"
        >
          {[
            {
              target: 50000,
              suffix: '+',
              label: t.hero.stats.students,
              icon: Users,
              color: 'indigo',
              delay: 300,
            },
            {
              target: 98,
              suffix: '%',
              label: t.hero.stats.satisfaction,
              icon: Star,
              color: 'teal',
              delay: 380,
            },
            {
              target: 200,
              suffix: '+',
              label: t.hero.stats.subjects,
              icon: BookOpen,
              color: 'violet',
              delay: 460,
            },
          ].map((stat) => (
            <Box
              key={stat.color}
              style={{
                animation: `study-mode-card-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${stat.delay}ms both`,
              }}
            >
              <CountUpStat
                target={stat.target}
                suffix={stat.suffix}
                label={stat.label}
                icon={stat.icon}
                color={stat.color}
              />
            </Box>
          ))}
        </SimpleGrid>
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
