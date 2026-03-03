'use client';

import { useEffect, useRef } from 'react';
import { applyReferralAtSignup } from '@/app/actions/referral-actions';

/**
 * Invisible component that checks localStorage for a referral code
 * (set during login/signup via ?ref= param) and applies it once.
 * Mount in the protected layout so it runs after auth.
 */
export function ReferralCapture() {
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current) return;
    const code = localStorage.getItem('referral_code');
    if (!code) return;
    applied.current = true;
    applyReferralAtSignup(code)
      .then(() => localStorage.removeItem('referral_code'))
      .catch(() => localStorage.removeItem('referral_code'));
  }, []);

  return null;
}
