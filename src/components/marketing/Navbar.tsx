import Image from 'next/image';
import Link from 'next/link';
import {
  Anchor,
  Box,
  Burger,
  Button,
  Collapse,
  Container,
  Group,
  Stack,
  Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useLanguage } from '@/i18n/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';

const Navbar = () => {
  const [opened, { toggle }] = useDisclosure(false);
  const { t } = useLanguage();

  const navLinkClassName =
    'nav-link relative cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:bg-gradient-to-r after:from-primary after:to-accent after:transition-transform hover:after:scale-x-100';

  return (
    <Box
      component="nav"
      className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50"
    >
      <Container size={1280} px={24}>
        <Group justify="space-between" h={64} wrap="nowrap">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" style={{ flexShrink: 0 }}>
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
            <Text component="span" fw={700} fz="1.25rem">
              AI UniTutor
            </Text>
          </Link>

          {/* Desktop Navigation */}
          <Group gap={24} visibleFrom="md" wrap="nowrap">
            <Anchor href="#features" className={navLinkClassName} underline="never" c="inherit">
              {t.nav.features}
            </Anchor>
            <Anchor href="#how-it-works" className={navLinkClassName} underline="never" c="inherit">
              {t.nav.howItWorks}
            </Anchor>
            <Anchor href="#testimonials" className={navLinkClassName} underline="never" c="inherit">
              {t.nav.testimonials}
            </Anchor>
            <Anchor href="#pricing" className={navLinkClassName} underline="never" c="inherit">
              {t.nav.pricing}
            </Anchor>
          </Group>

          {/* CTA Buttons */}
          <Group gap="xs" visibleFrom="md" wrap="nowrap" style={{ flexShrink: 0 }}>
            <LanguageSwitcher />
            <Button variant="subtle" color="gray" radius="md" component={Link} href="/login">
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
              <Anchor
                href="#features"
                py="0.5rem"
                className={navLinkClassName}
                underline="never"
                c="inherit"
              >
                {t.nav.features}
              </Anchor>
              <Anchor
                href="#how-it-works"
                py="0.5rem"
                className={navLinkClassName}
                underline="never"
                c="inherit"
              >
                {t.nav.howItWorks}
              </Anchor>
              <Anchor
                href="#testimonials"
                py="0.5rem"
                className={navLinkClassName}
                underline="never"
                c="inherit"
              >
                {t.nav.testimonials}
              </Anchor>
              <Anchor
                href="#pricing"
                py="0.5rem"
                className={navLinkClassName}
                underline="never"
                c="inherit"
              >
                {t.nav.pricing}
              </Anchor>
              <Stack gap="xs" className="pt-4">
                <LanguageSwitcher />
                <Button
                  variant="subtle"
                  color="gray"
                  radius="md"
                  fullWidth
                  component={Link}
                  href="/login"
                >
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
    </Box>
  );
};

export default Navbar;
