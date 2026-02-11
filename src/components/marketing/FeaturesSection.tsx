import { BookOpen, Brain, Clock, MessageSquare, Target, Zap } from 'lucide-react';
import { Box, Container, SimpleGrid, Text, Title } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const featureIcons = [Brain, BookOpen, Clock, MessageSquare, Target, Zap];

const FeaturesSection = () => {
  const { t } = useLanguage();

  return (
    <section id="features" className="py-16 md:py-20 relative scroll-mt-24">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/20 to-background" />

      <Container size="lg" px="md" className="relative z-10">
        {/* Section Header */}
        <Box className="text-center mb-10 md:mb-14">
          <Title order={2} className="font-display text-4xl md:text-5xl font-bold mb-4">
            {t.features.title} <span className="gradient-text">{t.features.titleHighlight}</span>
          </Title>
          <Text size="xl" c="dimmed" className="max-w-2xl mx-auto">
            {t.features.subtitle}
          </Text>
        </Box>

        {/* Features Grid */}
        <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="lg">
          {t.features.items.map((feature, index) => {
            const Icon = featureIcons[index];
            return (
              <Box
                key={index}
                className="glass-card p-6 md:p-8 hover:scale-[1.02] transition-all duration-300 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Icon className="w-7 h-7 text-primary" />
                </div>
                <Title order={3} className="font-display text-xl font-semibold mb-3">
                  {feature.title}
                </Title>
                <Text c="dimmed" className="leading-relaxed">
                  {feature.description}
                </Text>
              </Box>
            );
          })}
        </SimpleGrid>
      </Container>
    </section>
  );
};

export default FeaturesSection;
