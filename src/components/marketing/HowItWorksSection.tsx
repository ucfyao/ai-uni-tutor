import { GraduationCap, MessageCircle, TrendingUp, Upload } from 'lucide-react';
import { Badge, Box, Container, SimpleGrid, Text, Title } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const stepIcons = [Upload, MessageCircle, GraduationCap, TrendingUp];

const HowItWorksSection = () => {
  const { t } = useLanguage();

  return (
    <section id="how-it-works" className="py-16 md:py-20 relative overflow-hidden scroll-mt-24">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/20 to-background" />
      <div className="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2 w-[900px] h-[420px] bg-primary/10 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-10 left-1/4 w-72 h-72 bg-accent/10 rounded-full blur-[100px]" />

      <Container size="lg" px="md" className="relative z-10">
        {/* Section Header */}
        <Box className="text-center mb-10 md:mb-14">
          <Title order={2} className="font-display text-4xl md:text-5xl font-bold mb-4">
            {t.howItWorks.title}{' '}
            <span className="gradient-text">{t.howItWorks.titleHighlight}</span>{' '}
            {t.howItWorks.titleEnd}
          </Title>
          <Text size="xl" c="dimmed" className="max-w-2xl mx-auto">
            {t.howItWorks.subtitle}
          </Text>
        </Box>

        {/* Steps */}
        <Box className="relative">
          {/* Connection Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent -translate-y-1/2" />

          <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing="lg">
            {t.howItWorks.steps.map((step, index) => {
              const Icon = stepIcons[index];
              return (
                <Box key={index} className="relative group">
                  {/* Step Card */}
                  <Box className="glass-card p-6 md:p-8 text-center hover:scale-105 transition-all duration-300">
                    {/* Step Number */}
                    <Badge
                      className="absolute -top-4 left-1/2 -translate-x-1/2"
                      variant="gradient"
                      gradient={{ from: 'indigo', to: 'grape' }}
                      size="lg"
                    >
                      {step.step}
                    </Badge>

                    {/* Icon */}
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-secondary flex items-center justify-center mb-6 mt-4 group-hover:bg-primary/20 transition-colors duration-300">
                      <Icon className="w-8 h-8 text-primary" />
                    </div>

                    <Title order={3} className="font-display text-xl font-semibold mb-3">
                      {step.title}
                    </Title>
                    <Text c="dimmed">{step.description}</Text>
                  </Box>
                </Box>
              );
            })}
          </SimpleGrid>
        </Box>
      </Container>
    </section>
  );
};

export default HowItWorksSection;
