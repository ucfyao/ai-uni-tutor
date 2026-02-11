import Image from 'next/image';
import Link from 'next/link';
import { Anchor, Box, Container, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const Footer = () => {
  const { t } = useLanguage();

  const footerLinkClassName =
    'inline-flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground hover:decoration-primary/50 hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm text-sm';

  return (
    <footer className="py-10 md:py-12 border-t border-border/50">
      <Container size="lg" px="md">
        <SimpleGrid cols={{ base: 1, md: 4 }} spacing="lg" className="mb-10 md:mb-12">
          {/* Brand */}
          <Box className="md:col-span-1">
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
                <span className="font-display font-bold text-xl">AI UniTutor</span>
              </Link>
            </Box>
            <Text size="sm" c="dimmed">
              {t.footer.tagline}
            </Text>
          </Box>

          {/* Links */}
          <Box>
            <Text fw={600} mb="md">
              {t.footer.product.title}
            </Text>
            <Stack gap="xs">
              <Anchor href="#features" className={footerLinkClassName} underline="never">
                {t.footer.product.features}
              </Anchor>
              <Anchor href="/pricing" className={footerLinkClassName} underline="never">
                {t.footer.product.pricing}
              </Anchor>
              <Anchor href="#how-it-works" className={footerLinkClassName} underline="never">
                {t.footer.product.changelog}
              </Anchor>
              <Anchor href="/login" className={footerLinkClassName} underline="never">
                {t.footer.product.api}
              </Anchor>
            </Stack>
          </Box>

          <Box>
            <Text fw={600} mb="md">
              {t.footer.support.title}
            </Text>
            <Stack gap="xs">
              <Anchor href="/help" className={footerLinkClassName} underline="never">
                {t.footer.support.help}
              </Anchor>
              <Anchor href="#how-it-works" className={footerLinkClassName} underline="never">
                {t.footer.support.tutorials}
              </Anchor>
              <Anchor
                href="mailto:ucfyao@gmail.com"
                className={footerLinkClassName}
                underline="never"
              >
                {t.footer.support.contact}
              </Anchor>
              <Anchor href="/help" className={footerLinkClassName} underline="never">
                {t.footer.support.faq}
              </Anchor>
            </Stack>
          </Box>

          <Box>
            <Text fw={600} mb="md">
              {t.footer.legal.title}
            </Text>
            <Stack gap="xs">
              <Anchor href="#" className={footerLinkClassName} underline="never">
                {t.footer.legal.terms}
              </Anchor>
              <Anchor href="#" className={footerLinkClassName} underline="never">
                {t.footer.legal.privacy}
              </Anchor>
              <Anchor href="#" className={footerLinkClassName} underline="never">
                {t.footer.legal.cookies}
              </Anchor>
            </Stack>
          </Box>
        </SimpleGrid>

        {/* Bottom */}
        <Group
          justify="space-between"
          className="pt-6 md:pt-8 border-t border-border/50 flex-col md:flex-row gap-4"
        >
          <Text size="sm" c="dimmed">
            {t.footer.copyright}
          </Text>
          <Group gap="lg">
            <Anchor href="#" className={footerLinkClassName} underline="never">
              {t.footer.social.item1}
            </Anchor>
            <Anchor href="#" className={footerLinkClassName} underline="never">
              {t.footer.social.item2}
            </Anchor>
            <Anchor href="#" className={footerLinkClassName} underline="never">
              {t.footer.social.item3}
            </Anchor>
          </Group>
        </Group>
      </Container>
    </footer>
  );
};

export default Footer;
