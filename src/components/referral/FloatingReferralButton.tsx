'use client';

import { Gift, Sparkles } from 'lucide-react';
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
    <div className={styles.wrapper}>
      {/* Double pulse glow rings */}
      <div className={styles.pulseRing} />
      <div className={styles.pulseRing2} />

      {/* Sparkle dots */}
      <div className={`${styles.sparkle} ${styles.sparkle1}`} />
      <div className={`${styles.sparkle} ${styles.sparkle2}`} />
      <div className={`${styles.sparkle} ${styles.sparkle3}`} />

      {/* Main button */}
      <Tooltip label={t.sidebar.referral} position="left">
        <button
          className={styles.button}
          onClick={() => router.push('/referral')}
          aria-label={t.sidebar.referral}
        >
          <Gift size={22} strokeWidth={2.2} />
        </button>
      </Tooltip>

      {/* Gold badge */}
      <div className={styles.ribbon}>
        <Sparkles size={10} color="white" strokeWidth={2.5} />
      </div>
    </div>
  );
}
