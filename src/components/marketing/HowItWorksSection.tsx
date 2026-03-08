import { GraduationCap, MessageCircle, TrendingUp, Upload } from 'lucide-react';
import { Badge, Box, Container, Paper, SimpleGrid, Text, ThemeIcon, Title } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const stepIcons = [Upload, MessageCircle, GraduationCap, TrendingUp];
const stepColors = ['indigo', 'teal', 'violet', 'orange'];

const HowItWorksSection = () => {
  const { t } = useLanguage();

  return (
    <Box
      component="section"
      id="how-it-works"
      className="py-16 md:py-24 overflow-hidden scroll-mt-24"
    >
      <Container size={1280} px={24}>
        {/* Section Header */}
        <Box className="text-center mb-12 md:mb-16">
          <Title order={2} fz={{ base: '2.25rem', sm: '3rem' }} fw={700} mb="1rem">
            {t.howItWorks.title}{' '}
            <Text component="span" c="indigo.6" inherit>
              {t.howItWorks.titleHighlight}
            </Text>{' '}
            {t.howItWorks.titleEnd}
          </Title>
          <Text fz="1.25rem" c="dimmed" mx="auto" className="max-w-2xl">
            {t.howItWorks.subtitle}
          </Text>
        </Box>

        {/* Steps */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing={{ base: 24, sm: 32 }}>
          {t.howItWorks.steps.map((step, index) => {
            const Icon = stepIcons[index];
            const color = stepColors[index];
            return (
              <Paper
                key={index}
                p="lg"
                withBorder
                className="group hover:-translate-y-1 hover:shadow-xl"
                style={{
                  transition: 'all 0.28s cubic-bezier(0.25, 0.8, 0.25, 1)',
                  position: 'relative',
                  textAlign: 'center',
                  height: '100%',
                  animation: `study-mode-card-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${index * 80}ms both`,
                }}
              >
                {/* Step Number */}
                <Badge
                  color={color}
                  variant="filled"
                  size="lg"
                  radius="xl"
                  style={{
                    position: 'absolute',
                    top: -14,
                    left: '50%',
                    transform: 'translateX(-50%)',
                  }}
                >
                  {step.step}
                </Badge>

                {/* Icon */}
                <ThemeIcon
                  size={64}
                  radius="xl"
                  variant="light"
                  color={color}
                  className="group-hover:scale-110"
                  style={{ transition: 'transform 0.3s ease', margin: '1rem auto 1.5rem' }}
                >
                  <Icon size={32} strokeWidth={2} />
                </ThemeIcon>

                <Title order={3} fz="1.25rem" fw={600} mb="0.75rem">
                  {step.title}
                </Title>
                <Text c="dimmed" fz="sm" lh={1.625}>
                  {step.description}
                </Text>
              </Paper>
            );
          })}
        </SimpleGrid>
      </Container>
    </Box>
  );
};

export default HowItWorksSection;
