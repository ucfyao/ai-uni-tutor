import { Quote, Star } from 'lucide-react';
import { Avatar, Box, Container, Group, SimpleGrid } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const TestimonialsSection = () => {
  const { t } = useLanguage();

  return (
    <section id="testimonials" className="py-16 md:py-20 relative scroll-mt-24">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/10 to-background" />

      <Container size="lg" px={24} className="relative z-10">
        {/* Section Header */}
        <div className="text-center mb-10 md:mb-14">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            {t.testimonials.title}{' '}
            <span className="gradient-text">{t.testimonials.titleHighlight}</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t.testimonials.subtitle}
          </p>
        </div>

        {/* Testimonials Grid */}
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing={{ base: 24, md: 32 }}>
          {t.testimonials.items.map((testimonial, index) => (
            <Box
              key={index}
              className="glass-card p-6 md:p-8 relative group hover:scale-[1.02] transition-all duration-300"
            >
              {/* Quote Icon */}
              <Quote className="absolute top-6 right-6 w-10 h-10 text-primary/20" />

              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-primary text-primary" />
                ))}
              </div>

              {/* Content */}
              <p className="text-foreground/90 leading-relaxed mb-6">
                {'\u201C'}
                {testimonial.content}
                {'\u201D'}
              </p>

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
                <div>
                  <div className="font-semibold">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                </div>
              </Group>
            </Box>
          ))}
        </SimpleGrid>
      </Container>
    </section>
  );
};

export default TestimonialsSection;
