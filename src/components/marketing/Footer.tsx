import Image from 'next/image';
import Link from 'next/link';
import { Anchor, Box, Container, Group, SimpleGrid, Stack } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const Footer = () => {
  const { t } = useLanguage();

  const footerLinkClassName =
    'inline-flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground hover:underline hover:decoration-primary/50 hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm';

  return (
    <footer className="py-10 md:py-12 border-t border-border/50">
      <Container size="lg" px={24}>
        <SimpleGrid cols={{ base: 1, md: 4 }} spacing={32} className="mb-10 md:mb-12">
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
                <span className="font-display font-bold text-xl">AI UniTutor</span>
              </Link>
            </Box>
            <p className="text-muted-foreground text-sm">{t.footer.tagline}</p>
          </Box>

          {/* Links */}
          <Box>
            <h4 className="font-semibold mb-4">{t.footer.product.title}</h4>
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
            <h4 className="font-semibold mb-4">{t.footer.support.title}</h4>
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
            <h4 className="font-semibold mb-4">{t.footer.legal.title}</h4>
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
        <div className="pt-6 md:pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{t.footer.copyright}</p>
          <Group gap={24}>
            <Anchor
              href="#"
              className={`${footerLinkClassName} text-sm`}
              underline="never"
              c="inherit"
            >
              {t.footer.social.item1}
            </Anchor>
            <Anchor
              href="#"
              className={`${footerLinkClassName} text-sm`}
              underline="never"
              c="inherit"
            >
              {t.footer.social.item2}
            </Anchor>
            <Anchor
              href="#"
              className={`${footerLinkClassName} text-sm`}
              underline="never"
              c="inherit"
            >
              {t.footer.social.item3}
            </Anchor>
          </Group>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;
