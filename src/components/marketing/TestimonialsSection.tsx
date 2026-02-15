import { Quote, Star } from 'lucide-react';
import { Avatar, Box, Container, Group, Paper, ScrollArea, SimpleGrid, Text, Title } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const TestimonialsSection = () => {
  const { t } = useLanguage();

  return (
    <Box component="section" id="testimonials" className="py-16 md:py-24 relative scroll-mt-24">
      {/* Background */}
      <Box className="absolute inset-0 bg-gradient-to-b from-background via-secondary/10 to-background" />

      <Container size={1280} px={24} className="relative z-10">
        {/* Section Header */}
        <Box className="text-center mb-12 md:mb-16">
          <Title order={2} fz={{ base: '2.25rem', sm: '3rem' }} fw={700} mb="1rem">
            {t.testimonials.title}{' '}
            <span className="gradient-text">{t.testimonials.titleHighlight}</span>
          </Title>
          <Text fz="1.25rem" c="dimmed" mx="auto" className="max-w-2xl">
            {t.testimonials.subtitle}
          </Text>
        </Box>

        {/* Testimonials — Mobile horizontal scroll */}
        <Box hiddenFrom="sm">
          <ScrollArea type="never">
            <Group wrap="nowrap" gap="md" pb="md">
              {t.testimonials.items.map((testimonial, index) => (
                <Paper
                  key={index}
                  p="lg"
                  radius="md"
                  withBorder
                  miw={280}
                  className="relative"
                  style={{ flexShrink: 0 }}
                >
                  <Quote className="absolute top-4 right-4 w-8 h-8 text-primary/20" />
                  <Group gap={4} mb="sm">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </Group>
                  <Text lh={1.625} mb="md" style={{ color: 'hsl(var(--foreground) / 0.9)' }}>
                    {'\u201C'}
                    {testimonial.content}
                    {'\u201D'}
                  </Text>
                  <Group gap="md">
                    <Avatar
                      size={40}
                      color="indigo"
                      variant="gradient"
                      gradient={{ from: 'indigo.7', to: 'indigo.3' }}
                      radius="xl"
                    >
                      {testimonial.avatar}
                    </Avatar>
                    <Box>
                      <Text fw={600} fz="sm">{testimonial.name}</Text>
                      <Text size="xs" c="dimmed">{testimonial.role}</Text>
                    </Box>
                  </Group>
                </Paper>
              ))}
            </Group>
          </ScrollArea>
        </Box>

        {/* Testimonials — Desktop grid */}
        <SimpleGrid cols={3} spacing={36} visibleFrom="sm">
          {t.testimonials.items.map((testimonial, index) => (
            <Box
              key={index}
              className="glass-card p-6 md:p-8 relative group hover:scale-[1.02] transition-all duration-300"
            >
              <Quote className="absolute top-6 right-6 w-10 h-10 text-primary/20" />
              <Group gap={4} className="mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-primary text-primary" />
                ))}
              </Group>
              <Text lh={1.625} mb="1.5rem" style={{ color: 'hsl(var(--foreground) / 0.9)' }}>
                {'\u201C'}
                {testimonial.content}
                {'\u201D'}
              </Text>
              <Group gap="md">
                <Avatar
                  size={48}
                  color="indigo"
                  variant="gradient"
                  gradient={{ from: 'indigo.7', to: 'indigo.3' }}
                  radius="xl"
                >
                  {testimonial.avatar}
                </Avatar>
                <Box>
                  <Text fw={600}>{testimonial.name}</Text>
                  <Text size="sm" c="dimmed">{testimonial.role}</Text>
                </Box>
              </Group>
            </Box>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
};

export default TestimonialsSection;
