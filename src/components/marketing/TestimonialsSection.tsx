import { Quote, Star } from 'lucide-react';
import { Avatar, Box, Container, Group, SimpleGrid, Text, Title } from '@mantine/core';
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

        {/* Testimonials Grid */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={{ base: 24, sm: 36 }}>
          {t.testimonials.items.map((testimonial, index) => (
            <Box
              key={index}
              className="glass-card p-6 md:p-8 relative group hover:scale-[1.02] transition-all duration-300"
            >
              {/* Quote Icon */}
              <Quote className="absolute top-6 right-6 w-10 h-10 text-primary/20" />

              {/* Rating */}
              <Group gap={4} className="mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-primary text-primary" />
                ))}
              </Group>

              {/* Content */}
              <Text lh={1.625} mb="1.5rem" style={{ color: 'hsl(var(--foreground) / 0.9)' }}>
                {'\u201C'}
                {testimonial.content}
                {'\u201D'}
              </Text>

              {/* Author */}
              <Group gap="md">
                <Avatar
                  size={48}
                  color="indigo"
                  variant="gradient"
                  gradient={{ from: 'indigo', to: 'grape' }}
                  radius="xl"
                >
                  {testimonial.avatar}
                </Avatar>
                <Box>
                  <Text fw={600}>{testimonial.name}</Text>
                  <Text size="sm" c="dimmed">
                    {testimonial.role}
                  </Text>
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
