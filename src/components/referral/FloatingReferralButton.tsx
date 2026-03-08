'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Tooltip } from '@mantine/core';
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
      <button
        className={styles.giftButton}
        onClick={() => router.push('/referral')}
        aria-label={t.sidebar.referral}
      >
        🎁
      </button>
    </Tooltip>
  );
}
