import { BookOpen, Brain, Clock, MessageSquare, Target, Zap } from 'lucide-react';
import { Box, Container, SimpleGrid, Text, Title } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const featureIcons = [Brain, BookOpen, Clock, MessageSquare, Target, Zap];

const FeaturesSection = () => {
  const { t } = useLanguage();

  return (
    <Box component="section" id="features" className="py-16 md:py-24 relative scroll-mt-24">
      {/* Background */}
      <Box className="absolute inset-0 bg-gradient-to-b from-background via-secondary/20 to-background" />

      <Container size={1280} px={24} className="relative z-10">
        {/* Section Header */}
        <Box className="text-center mb-12 md:mb-16">
          <Title order={2} fz={{ base: '2.25rem', sm: '3rem' }} fw={700} mb="1rem">
            {t.features.title} <span className="gradient-text">{t.features.titleHighlight}</span>
          </Title>
          <Text fz="1.25rem" c="dimmed" mx="auto" className="max-w-2xl">
            {t.features.subtitle}
          </Text>
        </Box>

        {/* Features Grid */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing={{ base: 24, sm: 32 }}>
          {t.features.items.map((feature, index) => {
            const Icon = featureIcons[index];
            return (
              <Box
                key={index}
                className="glass-card p-6 md:p-8 hover:scale-[1.02] transition-all duration-300 group"
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    className="rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 group-hover:scale-110 transition-transform duration-300"
                  >
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                </div>
                <Title order={3} fz="1.25rem" fw={600} mb="0.75rem" ta="center">
                  {feature.title}
                </Title>
                <Text c="dimmed" lh={1.625} ta="center">
                  {feature.description}
                </Text>
              </Box>
            );
          })}
        </SimpleGrid>
      </Container>
    </Box>
  );
};

export default FeaturesSection;
