import { GraduationCap, MessageCircle, TrendingUp, Upload } from 'lucide-react';
import { Box, Container, SimpleGrid, Text, Title } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const stepIcons = [Upload, MessageCircle, GraduationCap, TrendingUp];

const HowItWorksSection = () => {
  const { t } = useLanguage();

  return (
    <Box
      component="section"
      id="how-it-works"
      className="py-16 md:py-20 relative overflow-hidden scroll-mt-24"
    >
      {/* Background */}
      <Box className="absolute inset-0 bg-gradient-to-b from-background via-secondary/20 to-background" />
      <Box className="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2 w-[900px] h-[420px] bg-primary/10 rounded-full blur-[120px]" />
      <Box className="pointer-events-none absolute bottom-10 left-1/4 w-72 h-72 bg-accent/10 rounded-full blur-[100px]" />

      <Container size={1280} px={24} className="relative z-10">
        {/* Section Header */}
        <Box className="text-center mb-10 md:mb-14">
          <Title order={2} fz={{ base: '2.25rem', sm: '3rem' }} fw={700} mb="1rem">
            {t.howItWorks.title}{' '}
            <span className="gradient-text">{t.howItWorks.titleHighlight}</span>{' '}
            {t.howItWorks.titleEnd}
          </Title>
          <Text fz="1.25rem" c="dimmed" mx="auto" className="max-w-2xl">
            {t.howItWorks.subtitle}
          </Text>
        </Box>

        {/* Steps */}
        <Box className="relative">
          {/* Connection Line */}
          <Box
            visibleFrom="md"
            className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent -translate-y-1/2"
          />

          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing={{ base: 24, sm: 24 }}>
            {t.howItWorks.steps.map((step, index) => {
              const Icon = stepIcons[index];
              return (
                <Box key={index} className="relative group" style={{ height: '100%' }}>
                  {/* Step Card */}
                  <Box
                    className="glass-card p-6 text-center hover:scale-105 transition-all duration-300"
                    style={{ height: '100%' }}
                  >
                    {/* Step Number */}
                    <Box className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-primary to-accent rounded-full">
                      <Text component="span" fw={700} fz="0.875rem" c="white">
                        {step.step}
                      </Text>
                    </Box>

                    {/* Icon */}
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '1rem auto 1.5rem',
                      }}
                      className="rounded-2xl bg-secondary group-hover:bg-primary/20 transition-colors duration-300"
                    >
                      <Icon className="w-8 h-8 text-primary" />
                    </div>

                    <Title order={3} fz="1.25rem" fw={600} mb="0.75rem">
                      {step.title}
                    </Title>
                    <Text c="dimmed" fz="sm" lh={1.625}>
                      {step.description}
                    </Text>
                  </Box>
                </Box>
              );
            })}
          </SimpleGrid>
        </Box>
      </Container>
    </Box>
  );
};

export default HowItWorksSection;
