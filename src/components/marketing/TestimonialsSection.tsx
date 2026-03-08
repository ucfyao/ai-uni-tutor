import { Quote, Star } from 'lucide-react';
import {
  Avatar,
  Box,
  Container,
  Group,
  Paper,
  ScrollArea,
  SimpleGrid,
  Text,
  Title,
} from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const TestimonialsSection = () => {
  const { t } = useLanguage();

  const renderCard = (testimonial: (typeof t.testimonials.items)[number], index: number) => (
    <Paper
      key={index}
      p={{ base: 'lg', md: 'xl' }}
      withBorder
      className="group hover:-translate-y-1 hover:shadow-xl"
      style={{
        transition: 'all 0.28s cubic-bezier(0.25, 0.8, 0.25, 1)',
        position: 'relative',
        animation: `study-mode-card-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${index * 80}ms both`,
      }}
    >
      <Quote
        size={32}
        className="absolute top-6 right-6"
        style={{ color: 'var(--mantine-color-indigo-2)' }}
      />
      <Group gap={4} mb="sm">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            size={18}
            fill="var(--mantine-color-yellow-5)"
            color="var(--mantine-color-yellow-5)"
          />
        ))}
      </Group>
      <Text lh={1.625} mb="1.5rem" c="dimmed">
        &ldquo;{testimonial.content}&rdquo;
      </Text>
      <Group gap="md">
        <Avatar size={48} color="indigo" variant="light" radius="xl">
          {testimonial.avatar}
        </Avatar>
        <Box>
          <Text fw={600}>{testimonial.name}</Text>
          <Text size="sm" c="dimmed">
            {testimonial.role}
          </Text>
        </Box>
      </Group>
    </Paper>
  );

  return (
    <Box component="section" id="testimonials" className="py-16 md:py-24 scroll-mt-24">
      <Container size={1280} px={24}>
        {/* Section Header */}
        <Box className="text-center mb-12 md:mb-16">
          <Title order={2} fz={{ base: '2.25rem', sm: '3rem' }} fw={700} mb="1rem">
            {t.testimonials.title}{' '}
            <Text component="span" c="indigo.6" inherit>
              {t.testimonials.titleHighlight}
            </Text>
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
                <Box key={index} miw={280} style={{ flexShrink: 0 }}>
                  {renderCard(testimonial, index)}
                </Box>
              ))}
            </Group>
          </ScrollArea>
        </Box>

        {/* Testimonials — Desktop grid */}
        <SimpleGrid cols={3} spacing={36} visibleFrom="sm">
          {t.testimonials.items.map((testimonial, index) => renderCard(testimonial, index))}
        </SimpleGrid>
      </Container>
    </Box>
  );
};

export default TestimonialsSection;
