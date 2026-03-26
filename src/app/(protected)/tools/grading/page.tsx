import { Suspense } from 'react';
import GradingPageClient from './GradingPageClient';

export default function GradingPage() {
  return (
    <Suspense>
      <GradingPageClient />
    </Suspense>
  );
}
