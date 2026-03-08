import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Badge, Box, Button, Container, Flex, Paper, Text, Title } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const CTASection = () => {
  const { t } = useLanguage();

  return (
    <Box component="section" className="py-16 md:py-24 overflow-hidden">
      <Container size={1280} px={24}>
        <Paper
          p={{ base: 'xl', sm: 32, md: 56 }}
          withBorder
          className="text-center"
          maw={960}
          mx="auto"
        >
          {/* Badge */}
          <Box mb="1.5rem">
            <Badge
              variant="light"
              color="indigo"
              size="lg"
              radius="xl"
              leftSection={<Sparkles size={14} />}
            >
              {t.cta.badge}
            </Badge>
          </Box>

          <Title order={2} fz={{ base: '2.25rem', sm: '3rem' }} fw={700} mb="1.5rem">
            {t.cta.title}
            <Text component="span" c="indigo.6" inherit>
              {t.cta.titleHighlight}
            </Text>
            {t.cta.titleEnd}
          </Title>

          <Text fz="1.25rem" c="dimmed" mx="auto" mb="2rem" className="max-w-2xl">
            {t.cta.subtitle}
          </Text>

          <Flex
            direction={{ base: 'column', sm: 'row' }}
            align="center"
            justify="center"
            gap="md"
            wrap="wrap"
          >
            <Button
              size="xl"
              color="indigo"
              component={Link}
              href="/login"
              rightSection={<ArrowRight size={20} />}
            >
              {t.cta.startTrial}
            </Button>
            <Button
              size="xl"
              variant="light"
              color="indigo"
              component="a"
              href="mailto:ucfyao@gmail.com"
            >
              {t.cta.contactUs}
            </Button>
          </Flex>

          <Text size="sm" c="dimmed" mt="1.5rem">
            {t.cta.note}
          </Text>
        </Paper>
      </Container>
    </Box>
  );
};

export default CTASection;
