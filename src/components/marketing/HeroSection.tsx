import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Badge, Box, Button, Container, Group, SimpleGrid, Text, Title } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const HeroSection = () => {
  const { t } = useLanguage();

  return (
    <section className="relative min-h-[100svh] flex items-start justify-center overflow-hidden pt-24 md:pt-28 pb-16 bg-background">
      {/* Background Effects */}
      <div className="absolute inset-0 hero-radial" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pulse-glow" />
      <div
        className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-accent/10 rounded-full blur-[100px] pulse-glow"
        style={{ animationDelay: '1.5s' }}
      />

      {/* Grid Pattern */}
      <div className="absolute inset-0 hero-grid" />

      <Container size="lg" px="md" className="relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <Badge
            variant="light"
            size="lg"
            leftSection={<Sparkles className="w-4 h-4" />}
            className="animate-fade-in-up opacity-0 mb-8"
          >
            {t.hero.badge}
          </Badge>

          {/* Main Heading */}
          <Title
            order={1}
            className="font-display text-4xl sm:text-5xl md:text-7xl font-bold leading-tight mb-6 animate-fade-in-up opacity-0 animate-delay-100 text-foreground"
          >
            {t.hero.title}
            <span className="gradient-text">{t.hero.titleHighlight}</span>
          </Title>

          {/* Subheading */}
          <Text
            size="xl"
            className="md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in-up opacity-0 animate-delay-200"
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
            cols={{ base: 1, sm: 3 }}
            spacing="lg"
            className="mt-12 sm:mt-16 pt-12 sm:pt-16 border-t border-border/30 animate-fade-in-up opacity-0 animate-delay-400"
          >
            <Box>
              <Text className="font-display text-3xl sm:text-4xl font-bold gradient-text">
                50K+
              </Text>
              <Text className="text-muted-foreground mt-1">{t.hero.stats.students}</Text>
            </Box>
            <Box>
              <Text className="font-display text-3xl sm:text-4xl font-bold gradient-text">98%</Text>
              <Text className="text-muted-foreground mt-1">{t.hero.stats.satisfaction}</Text>
            </Box>
            <Box>
              <Text className="font-display text-3xl sm:text-4xl font-bold gradient-text">
                200+
              </Text>
              <Text className="text-muted-foreground mt-1">{t.hero.stats.subjects}</Text>
            </Box>
          </SimpleGrid>
        </div>
      </Container>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-muted-foreground/50 rounded-full" />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
