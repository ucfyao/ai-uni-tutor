import Image from 'next/image';
import Link from 'next/link';
import { Anchor, Box, Container, Flex, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const Footer = () => {
  const { t } = useLanguage();

  return (
    <Box
      component="footer"
      py={{ base: 'xl', md: 32 }}
      style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
    >
      <Container size={960} px={24}>
        <SimpleGrid
          cols={{ base: 1, sm: 4 }}
          spacing={{ base: 24, sm: 32 }}
          mb={{ base: 'xl', sm: 32 }}
        >
          {/* Brand */}
          <Box>
            <Box className="flex items-center gap-2 mb-4">
              <Link href="/" className="flex items-center gap-2">
                <Box className="w-9 h-9 flex items-center justify-center">
                  <Image
                    src="/assets/logo.png"
                    alt="AI UniTutor"
                    width={36}
                    height={36}
                    className="w-9 h-9 object-contain"
                  />
                </Box>
                <Text component="span" fw={700} fz="lg">
                  AI UniTutor
                </Text>
              </Link>
            </Box>
            <Text size="sm" c="dimmed">
              {t.footer.tagline}
            </Text>
          </Box>

          {/* Links */}
          <Box>
            <Text fw={600} mb="md" fz="sm">
              {t.footer.product.title}
            </Text>
            <Stack gap={8}>
              <Anchor href="#features" underline="hover" c="dimmed" fz="sm">
                {t.footer.product.features}
              </Anchor>
              <Anchor href="/pricing" underline="hover" c="dimmed" fz="sm">
                {t.footer.product.pricing}
              </Anchor>
              <Anchor href="#how-it-works" underline="hover" c="dimmed" fz="sm">
                {t.footer.product.changelog}
              </Anchor>
              <Anchor href="/login" underline="hover" c="dimmed" fz="sm">
                {t.footer.product.api}
              </Anchor>
            </Stack>
          </Box>

          <Box>
            <Text fw={600} mb="md" fz="sm">
              {t.footer.support.title}
            </Text>
            <Stack gap={8}>
              <Anchor href="/help" underline="hover" c="dimmed" fz="sm">
                {t.footer.support.help}
              </Anchor>
              <Anchor href="#how-it-works" underline="hover" c="dimmed" fz="sm">
                {t.footer.support.tutorials}
              </Anchor>
              <Anchor href="mailto:ucfyao@gmail.com" underline="hover" c="dimmed" fz="sm">
                {t.footer.support.contact}
              </Anchor>
              <Anchor href="/help" underline="hover" c="dimmed" fz="sm">
                {t.footer.support.faq}
              </Anchor>
            </Stack>
          </Box>

          <Box>
            <Text fw={600} mb="md" fz="sm">
              {t.footer.legal.title}
            </Text>
            <Stack gap={8}>
              <Anchor href="#" underline="hover" c="dimmed" fz="sm">
                {t.footer.legal.terms}
              </Anchor>
              <Anchor href="#" underline="hover" c="dimmed" fz="sm">
                {t.footer.legal.privacy}
              </Anchor>
              <Anchor href="#" underline="hover" c="dimmed" fz="sm">
                {t.footer.legal.cookies}
              </Anchor>
            </Stack>
          </Box>
        </SimpleGrid>

        {/* Bottom */}
        <Flex
          direction={{ base: 'column', sm: 'row' }}
          align="center"
          justify="space-between"
          gap="md"
          pt="lg"
          style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
        >
          <Text size="sm" c="dimmed">
            {t.footer.copyright}
          </Text>
          <Group gap="xl">
            <Anchor href="#" fz="sm" underline="hover" c="dimmed">
              {t.footer.social.item1}
            </Anchor>
            <Anchor href="#" fz="sm" underline="hover" c="dimmed">
              {t.footer.social.item2}
            </Anchor>
            <Anchor href="#" fz="sm" underline="hover" c="dimmed">
              {t.footer.social.item3}
            </Anchor>
          </Group>
        </Flex>
      </Container>
    </Box>
  );
};

export default Footer;
