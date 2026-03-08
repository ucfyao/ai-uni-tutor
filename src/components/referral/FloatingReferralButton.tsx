'use client';

import { Gift } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { ActionIcon, Tooltip } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';
import styles from './FloatingReferralButton.module.css';

export function FloatingReferralButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();

  // Hide on the referral page itself
  if (pathname.startsWith('/referral')) return null;

  return (
    <Tooltip label={t.sidebar.referral} position="left">
      <ActionIcon
        className={styles.floatingButton}
        size={48}
        radius="xl"
        variant="filled"
        color="red"
        onClick={() => router.push('/referral')}
        aria-label={t.sidebar.referral}
      >
        <Gift size={22} />
      </ActionIcon>
    </Tooltip>
  );
}
