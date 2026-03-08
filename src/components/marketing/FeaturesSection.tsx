import { BookOpen, Brain, Clock, MessageSquare, Target, Zap } from 'lucide-react';
import { Box, Container, Paper, SimpleGrid, Text, ThemeIcon, Title } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const featureIcons = [Brain, BookOpen, Clock, MessageSquare, Target, Zap];
const featureColors = ['indigo', 'teal', 'orange', 'violet', 'cyan', 'yellow'];

const FeaturesSection = () => {
  const { t } = useLanguage();

  return (
    <Box component="section" id="features" className="py-16 md:py-24 scroll-mt-24">
      <Container size={1280} px={24}>
        {/* Section Header */}
        <Box className="text-center mb-12 md:mb-16">
          <Title order={2} fz={{ base: '2.25rem', sm: '3rem' }} fw={700} mb="1rem">
            {t.features.title}{' '}
            <Text component="span" c="indigo.6" inherit>
              {t.features.titleHighlight}
            </Text>
          </Title>
          <Text fz="1.25rem" c="dimmed" mx="auto" className="max-w-2xl">
            {t.features.subtitle}
          </Text>
        </Box>

        {/* Features Grid */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing={{ base: 24, sm: 32 }}>
          {t.features.items.map((feature, index) => {
            const Icon = featureIcons[index];
            const color = featureColors[index];
            return (
              <Paper
                key={index}
                p={{ base: 'lg', md: 'xl' }}
                withBorder
                className="group hover:-translate-y-1 hover:shadow-xl"
                style={{
                  transition: 'all 0.28s cubic-bezier(0.25, 0.8, 0.25, 1)',
                  animation: `study-mode-card-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${index * 80}ms both`,
                }}
              >
                <Box ta="center">
                  <ThemeIcon
                    size={56}
                    radius="xl"
                    variant="light"
                    color={color}
                    className="group-hover:scale-110"
                    style={{ transition: 'transform 0.3s ease', margin: '0 auto 1.5rem' }}
                  >
                    <Icon size={28} strokeWidth={2} />
                  </ThemeIcon>
                  <Title order={3} fz="1.25rem" fw={600} mb="0.75rem">
                    {feature.title}
                  </Title>
                  <Text c="dimmed" lh={1.625} ta="center">
                    {feature.description}
                  </Text>
                </Box>
              </Paper>
            );
          })}
        </SimpleGrid>
      </Container>
    </Box>
  );
};

export default FeaturesSection;
