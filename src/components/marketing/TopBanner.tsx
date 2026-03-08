import { X } from 'lucide-react';
import Link from 'next/link';
import { Box, CloseButton, Container, Group, Text } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

interface TopBannerProps {
  onClose: () => void;
}

const TopBanner = ({ onClose }: TopBannerProps) => {
  const { t } = useLanguage();

  return (
    <Box
      component={Link}
      href="/partner"
      className="block"
      py={8}
      style={{
        background: 'linear-gradient(135deg, #f59e0b, #f97316)',
        cursor: 'pointer',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 51,
      }}
    >
      <Container size={960} px={24}>
        <Group justify="center" gap="xs" wrap="nowrap">
          <Text fz="sm" fw={600} c="white" ta="center">
            💰 {t.topBanner.text}{' '}
            <Text component="span" fz="sm" fw={700} c="white" td="underline">
              {t.topBanner.cta}
            </Text>
          </Text>
          <CloseButton
            size="sm"
            variant="transparent"
            c="white"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close banner"
            style={{ opacity: 0.8, flexShrink: 0 }}
            icon={<X size={14} />}
          />
        </Group>
      </Container>
    </Box>
  );
};

export default TopBanner;
