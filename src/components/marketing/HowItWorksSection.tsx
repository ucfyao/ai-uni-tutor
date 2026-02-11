import { GraduationCap, MessageCircle, TrendingUp, Upload } from 'lucide-react';
import { Box, Container, SimpleGrid } from '@mantine/core';
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

      <Container size="lg" px={24} className="relative z-10">
        {/* Section Header */}
        <div className="text-center mb-10 md:mb-14">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            {t.howItWorks.title}{' '}
            <span className="gradient-text">{t.howItWorks.titleHighlight}</span>{' '}
            {t.howItWorks.titleEnd}
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">{t.howItWorks.subtitle}</p>
        </div>

        {/* Steps */}
        <Box className="relative">
          {/* Connection Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent -translate-y-1/2" />

          <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing={{ base: 24, md: 32 }}>
            {t.howItWorks.steps.map((step, index) => {
              const Icon = stepIcons[index];
              return (
                <Box key={index} className="relative group">
                  {/* Step Card */}
                  <Box className="glass-card p-6 md:p-8 text-center hover:scale-105 transition-all duration-300">
                    {/* Step Number */}
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-primary to-accent rounded-full">
                      <span className="font-display font-bold text-sm text-primary-foreground">
                        {step.step}
                      </span>
                    </div>

                    {/* Icon */}
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-secondary flex items-center justify-center mb-6 mt-4 group-hover:bg-primary/20 transition-colors duration-300">
                      <Icon className="w-8 h-8 text-primary" />
                    </div>

                    <h3 className="font-display text-xl font-semibold mb-3">{step.title}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
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
