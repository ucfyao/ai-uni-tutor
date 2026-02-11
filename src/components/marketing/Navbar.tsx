import Image from 'next/image';
import Link from 'next/link';
import { Anchor, Box, Burger, Button, Collapse, Container, Group, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useLanguage } from '@/i18n/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';

const Navbar = () => {
  const [opened, { toggle }] = useDisclosure(false);
  const { t } = useLanguage();

  const navLinkClassName =
    'relative inline-flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:bg-gradient-to-r after:from-primary after:to-accent after:transition-transform hover:after:scale-x-100';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <Container size="lg" px="md">
        <Group justify="space-between" h={64}>
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Box className="w-10 h-10 flex items-center justify-center">
              <Image
                src="/assets/logo.png"
                alt="AI UniTutor"
                width={40}
                height={40}
                className="w-10 h-10 object-contain"
                priority
              />
            </Box>
            <span className="font-display font-bold text-xl">AI UniTutor</span>
          </Link>

          {/* Desktop Navigation */}
          <Group gap="lg" visibleFrom="md">
            <Anchor href="#features" className={navLinkClassName} underline="never">
              {t.nav.features}
            </Anchor>
            <Anchor href="#how-it-works" className={navLinkClassName} underline="never">
              {t.nav.howItWorks}
            </Anchor>
            <Anchor href="#testimonials" className={navLinkClassName} underline="never">
              {t.nav.testimonials}
            </Anchor>
            <Anchor href="#pricing" className={navLinkClassName} underline="never">
              {t.nav.pricing}
            </Anchor>
          </Group>

          {/* CTA Buttons */}
          <Group gap="xs" visibleFrom="md">
            <LanguageSwitcher />
            <Button variant="subtle" component={Link} href="/login">
              {t.nav.login}
            </Button>
            <Button className="btn-hero" component={Link} href="/login">
              {t.nav.freeTrial}
            </Button>
          </Group>

          {/* Mobile Menu Button */}
          <Burger opened={opened} onClick={toggle} hiddenFrom="md" />
        </Group>

        {/* Mobile Menu */}
        <Collapse in={opened} hiddenFrom="md">
          <Box className="py-4 border-t border-border/50">
            <Stack gap="md">
              <Anchor href="#features" className={`${navLinkClassName} py-2`} underline="never">
                {t.nav.features}
              </Anchor>
              <Anchor href="#how-it-works" className={`${navLinkClassName} py-2`} underline="never">
                {t.nav.howItWorks}
              </Anchor>
              <Anchor href="#testimonials" className={`${navLinkClassName} py-2`} underline="never">
                {t.nav.testimonials}
              </Anchor>
              <Anchor href="#pricing" className={`${navLinkClassName} py-2`} underline="never">
                {t.nav.pricing}
              </Anchor>
              <Stack gap="xs" className="pt-4">
                <LanguageSwitcher />
                <Button variant="subtle" fullWidth component={Link} href="/login">
                  {t.nav.login}
                </Button>
                <Button className="btn-hero" fullWidth component={Link} href="/login">
                  {t.nav.freeTrial}
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Collapse>
      </Container>
    </nav>
  );
};

export default Navbar;
