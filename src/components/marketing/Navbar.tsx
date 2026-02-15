import { Moon, Sun } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Anchor,
  Box,
  Burger,
  Button,
  Collapse,
  Container,
  Group,
  Stack,
  Text,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useLanguage } from '@/i18n/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';

const ColorSchemeToggle = () => {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });

  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="lg"
      onClick={() => setColorScheme(computedColorScheme === 'light' ? 'dark' : 'light')}
      aria-label="Toggle color scheme"
    >
      <Box component="span" lightHidden>
        <Sun size={18} />
      </Box>
      <Box component="span" darkHidden>
        <Moon size={18} />
      </Box>
    </ActionIcon>
  );
};

const Navbar = () => {
  const [opened, { toggle }] = useDisclosure(false);
  const [scrolled, setScrolled] = useState(false);
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const { t } = useLanguage();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinkClassName =
    'nav-link relative cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:bg-gradient-to-r after:from-primary after:to-accent after:transition-transform hover:after:scale-x-100';

  return (
    <Box
      component="nav"
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        backdropFilter: scrolled ? 'blur(12px)' : undefined,
        WebkitBackdropFilter: scrolled ? 'blur(12px)' : undefined,
        boxShadow: scrolled ? 'var(--mantine-shadow-sm)' : undefined,
        backgroundColor: scrolled
          ? computedColorScheme === 'dark'
            ? 'rgba(0, 0, 0, 0.8)'
            : 'rgba(255, 255, 255, 0.8)'
          : 'transparent',
        borderBottom: scrolled ? '1px solid var(--mantine-color-default-border)' : undefined,
        transition: 'all 0.3s ease',
      }}
    >
      <Container size={1280} px={24}>
        <Group justify="space-between" h={72} wrap="nowrap">
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
          <Group gap={32} visibleFrom="md" wrap="nowrap">
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
          <Group gap="sm" visibleFrom="md" wrap="nowrap" style={{ flexShrink: 0 }}>
            <LanguageSwitcher />
            <ColorSchemeToggle />
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
                <Group gap="sm">
                  <LanguageSwitcher />
                  <ColorSchemeToggle />
                </Group>
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
