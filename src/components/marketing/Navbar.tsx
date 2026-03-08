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

interface NavbarProps {
  bannerVisible?: boolean;
}

const Navbar = ({ bannerVisible = false }: NavbarProps) => {
  const [opened, { toggle }] = useDisclosure(false);
  const [scrolled, setScrolled] = useState(false);
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const { t } = useLanguage();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <Box
      component="nav"
      className="fixed left-0 right-0 z-50"
      style={{
        top: bannerVisible ? 40 : 0,
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
      <Container size={960} px={24}>
        <Group justify="space-between" h={64} wrap="nowrap">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" style={{ flexShrink: 0 }}>
            <Box className="w-9 h-9 flex items-center justify-center">
              <Image
                src="/assets/logo.png"
                alt="AI UniTutor"
                width={36}
                height={36}
                className="w-9 h-9 object-contain"
                priority
              />
            </Box>
            <Text component="span" fw={700} fz="lg">
              AI UniTutor
            </Text>
          </Link>

          {/* Desktop Navigation */}
          <Group gap="xl" visibleFrom="md" wrap="nowrap">
            <Anchor href="#features" underline="hover" c="dimmed" fz="sm" fw={500}>
              {t.nav.features}
            </Anchor>
            <Anchor href="#how-it-works" underline="hover" c="dimmed" fz="sm" fw={500}>
              {t.nav.howItWorks}
            </Anchor>
            <Anchor href="#testimonials" underline="hover" c="dimmed" fz="sm" fw={500}>
              {t.nav.testimonials}
            </Anchor>
            <Anchor href="#pricing" underline="hover" c="dimmed" fz="sm" fw={500}>
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
            <Button color="indigo" radius="md" component={Link} href="/login">
              {t.nav.freeTrial}
            </Button>
          </Group>

          {/* Mobile Menu Button */}
          <Burger opened={opened} onClick={toggle} hiddenFrom="md" />
        </Group>

        {/* Mobile Menu */}
        <Collapse in={opened} hiddenFrom="md">
          <Box py="md" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
            <Stack gap="md">
              <Anchor href="#features" underline="hover" c="dimmed" fz="sm" fw={500}>
                {t.nav.features}
              </Anchor>
              <Anchor href="#how-it-works" underline="hover" c="dimmed" fz="sm" fw={500}>
                {t.nav.howItWorks}
              </Anchor>
              <Anchor href="#testimonials" underline="hover" c="dimmed" fz="sm" fw={500}>
                {t.nav.testimonials}
              </Anchor>
              <Anchor href="#pricing" underline="hover" c="dimmed" fz="sm" fw={500}>
                {t.nav.pricing}
              </Anchor>
              <Stack gap="xs" pt="sm">
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
                <Button color="indigo" radius="md" fullWidth component={Link} href="/login">
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
