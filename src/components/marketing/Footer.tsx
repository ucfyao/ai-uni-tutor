import Image from 'next/image';
import Link from 'next/link';
import { Anchor, Box, Container, Flex, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const Footer = () => {
  const { t } = useLanguage();

  const footerLinkClassName =
    'inline-flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground hover:underline hover:decoration-primary/50 hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm';

  return (
    <Box component="footer" className="py-10 md:py-12 border-t border-border/50">
      <Container size={1280} px={24}>
        <SimpleGrid
          cols={{ base: 1, sm: 4 }}
          spacing={{ base: 24, sm: 32 }}
          mb={{ base: '2.5rem', sm: '3rem' }}
        >
          {/* Brand */}
          <Box>
            <Box className="flex items-center gap-2 mb-4">
              <Link href="/" className="flex items-center gap-2">
                <Box className="w-10 h-10 flex items-center justify-center">
                  <Image
                    src="/assets/logo.png"
                    alt="AI UniTutor"
                    width={40}
                    height={40}
                    className="w-10 h-10 object-contain"
                  />
                </Box>
                <Text component="span" fw={700} fz="1.25rem">
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
            <Text fw={600} mb="1rem">
              {t.footer.product.title}
            </Text>
            <Stack gap={8}>
              <Anchor
                href="#features"
                className={footerLinkClassName}
                underline="never"
                c="inherit"
              >
                {t.footer.product.features}
              </Anchor>
              <Anchor href="/pricing" className={footerLinkClassName} underline="never" c="inherit">
                {t.footer.product.pricing}
              </Anchor>
              <Anchor
                href="#how-it-works"
                className={footerLinkClassName}
                underline="never"
                c="inherit"
              >
                {t.footer.product.changelog}
              </Anchor>
              <Anchor href="/login" className={footerLinkClassName} underline="never" c="inherit">
                {t.footer.product.api}
              </Anchor>
            </Stack>
          </Box>

          <Box>
            <Text fw={600} mb="1rem">
              {t.footer.support.title}
            </Text>
            <Stack gap={8}>
              <Anchor href="/help" className={footerLinkClassName} underline="never" c="inherit">
                {t.footer.support.help}
              </Anchor>
              <Anchor
                href="#how-it-works"
                className={footerLinkClassName}
                underline="never"
                c="inherit"
              >
                {t.footer.support.tutorials}
              </Anchor>
              <Anchor
                href="mailto:ucfyao@gmail.com"
                className={footerLinkClassName}
                underline="never"
                c="inherit"
              >
                {t.footer.support.contact}
              </Anchor>
              <Anchor href="/help" className={footerLinkClassName} underline="never" c="inherit">
                {t.footer.support.faq}
              </Anchor>
            </Stack>
          </Box>

          <Box>
            <Text fw={600} mb="1rem">
              {t.footer.legal.title}
            </Text>
            <Stack gap={8}>
              <Anchor href="#" className={footerLinkClassName} underline="never" c="inherit">
                {t.footer.legal.terms}
              </Anchor>
              <Anchor href="#" className={footerLinkClassName} underline="never" c="inherit">
                {t.footer.legal.privacy}
              </Anchor>
              <Anchor href="#" className={footerLinkClassName} underline="never" c="inherit">
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
          className="pt-6 md:pt-8 border-t border-border/50"
        >
          <Text size="sm" c="dimmed">
            {t.footer.copyright}
          </Text>
          <Group gap={24}>
            <Anchor href="#" fz="sm" className={footerLinkClassName} underline="never" c="inherit">
              {t.footer.social.item1}
            </Anchor>
            <Anchor href="#" fz="sm" className={footerLinkClassName} underline="never" c="inherit">
              {t.footer.social.item2}
            </Anchor>
            <Anchor href="#" fz="sm" className={footerLinkClassName} underline="never" c="inherit">
              {t.footer.social.item3}
            </Anchor>
          </Group>
        </Flex>
      </Container>
    </Box>
  );
};

export default Footer;
