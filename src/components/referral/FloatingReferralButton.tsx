'use client';

import { X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Tooltip } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';
import styles from './FloatingReferralButton.module.css';

export function FloatingReferralButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || pathname.startsWith('/referral')) return null;

  return (
    <div className={styles.wrapper}>
      {/* Triple pulse rings */}
      <div className={styles.pulseRing} />
      <div className={styles.pulseRing2} />
      <div className={styles.pulseRing3} />

      {/* Close button */}
      <button
        className={styles.closeButton}
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        aria-label="Close"
      >
        <X size={8} strokeWidth={2} />
      </button>

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
