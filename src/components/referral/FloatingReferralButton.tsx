'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Tooltip } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';
import styles from './FloatingReferralButton.module.css';

export function FloatingReferralButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();

  if (pathname.startsWith('/referral')) return null;

  return (
    <div className={styles.wrapper}>
      {/* Triple pulse rings */}
      <div className={styles.pulseRing} />
      <div className={styles.pulseRing2} />
      <div className={styles.pulseRing3} />

      {/* Sparkle dots */}
      <div className={`${styles.sparkle} ${styles.sparkle1}`} />
      <div className={`${styles.sparkle} ${styles.sparkle2}`} />
      <div className={`${styles.sparkle} ${styles.sparkle3}`} />
      <div className={`${styles.sparkle} ${styles.sparkle4}`} />
      <div className={`${styles.sparkle} ${styles.sparkle5}`} />

      {/* Orbiting particles */}
      <div className={`${styles.orbit} ${styles.orbit1}`} />
      <div className={`${styles.orbit} ${styles.orbit2}`} />

      {/* Emoji button */}
      <Tooltip label={t.sidebar.referral} position="left">
        <button
          className={styles.giftButton}
          onClick={() => router.push('/referral')}
          aria-label={t.sidebar.referral}
        >
          🎁
        </button>
      </Tooltip>
    </div>
  );
}
