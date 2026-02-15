# Pricing Page Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace placeholder course pricing cards with a functional Free vs Pro subscription comparison page, with monthly/semester billing toggle and live Stripe checkout.

**Architecture:** The pricing page becomes a client component with a SegmentedControl toggle that switches between monthly and semester billing. The Stripe checkout API route is updated to accept a `plan` parameter to select the correct Price ID. Translations are replaced for both zh and en.

**Tech Stack:** Next.js 16 App Router, React 19, Mantine v8, Stripe, i18n via `useLanguage()`

---

### Task 1: Update i18n translations

**Files:**

- Modify: `src/i18n/translations.ts:386-399` (zh pricing block)
- Modify: `src/i18n/translations.ts:891-909` (en pricing block)

**Step 1: Replace zh pricing translations**

Find the existing zh pricing block (lines 386-399) and replace with:

```ts
    // Pricing Page
    pricing: {
      title: '定价',
      subtitle: '选择适合你的方案，随时升级解锁全部功能。',
      monthly: '月付',
      semester: '学期付',
      saveBadge: '省 33%',
      free: {
        name: '免费版',
        price: '$0',
        period: '永久免费',
        features: [
          '每日 3 次 AI 对话',
          '基础文档上传（5MB）',
          '课程讲座模式',
          '作业辅导模式',
        ],
        cta: '当前方案',
      },
      pro: {
        name: 'Pro',
        priceMonthly: '$9.99',
        priceSemester: '$39.99',
        periodMonthly: '/月',
        periodSemester: '/学期',
        originalPrice: '$59.94',
        features: [
          '无限 AI 对话',
          '无限文档上传',
          '高级 RAG 混合搜索',
          '全部辅导模式',
          '模拟考试与评分',
          '优先 AI 处理速度',
          '优先支持',
        ],
        cta: '立即升级',
        currentPlan: '当前方案',
      },
      securePayment: '通过 Stripe 安全支付。随时取消。',
      errorTitle: '错误',
    },
```

**Step 2: Replace en pricing translations**

Find the existing en pricing block (lines 891-909) and replace with:

```ts
    // Pricing Page
    pricing: {
      title: 'Pricing',
      subtitle: 'Choose the plan that fits you. Upgrade anytime to unlock full access.',
      monthly: 'Monthly',
      semester: 'Semester',
      saveBadge: 'Save 33%',
      free: {
        name: 'Free',
        price: '$0',
        period: 'Free forever',
        features: [
          '3 AI conversations per day',
          'Basic document upload (5MB)',
          'Lecture Helper mode',
          'Assignment Coach mode',
        ],
      cta: 'Current Plan',
      },
      pro: {
        name: 'Pro',
        priceMonthly: '$9.99',
        priceSemester: '$39.99',
        periodMonthly: '/month',
        periodSemester: '/semester',
        originalPrice: '$59.94',
        features: [
          'Unlimited AI conversations',
          'Unlimited document uploads',
          'Advanced RAG hybrid search',
          'All tutoring modes',
          'Mock exams with scoring',
          'Priority AI processing',
          'Priority support',
        ],
        cta: 'Upgrade Now',
        currentPlan: 'Current Plan',
      },
      securePayment: 'Secure payment via Stripe. Cancel anytime.',
      errorTitle: 'Error',
    },
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/i18n/translations.ts
git commit -m "feat(ui): update pricing i18n for subscription model"
```

---

### Task 2: Update Stripe checkout API route

**Files:**

- Modify: `src/app/api/stripe/checkout/route.ts`
- Modify: `.env.example` (add new env var entries)

**Step 1: Update the checkout route to accept plan parameter**

Replace the entire file `src/app/api/stripe/checkout/route.ts` with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getProfileService } from '@/lib/services/ProfileService';
import { stripe } from '@/lib/stripe';
import { getCurrentUser } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const profileService = getProfileService();
    let stripeCustomerId = await profileService.getStripeCustomerId(user.id);

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      });
      stripeCustomerId = customer.id;

      await profileService.updateStripeCustomerId(user.id, customer.id);
    }

    // Determine which price to use based on plan parameter
    let plan: string = 'monthly';
    try {
      const body = await req.json();
      if (body.plan === 'semester') plan = 'semester';
    } catch {
      // No body or invalid JSON — default to monthly
    }

    const priceId =
      plan === 'semester'
        ? process.env.STRIPE_PRICE_ID_SEMESTER
        : process.env.STRIPE_PRICE_ID_MONTHLY;

    if (!priceId) {
      return new NextResponse(`Stripe Price ID for ${plan} plan is missing`, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      billing_address_collection: 'auto',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/settings?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/settings?canceled=true`,
      metadata: {
        userId: user.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[STRIPE_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
```

**Step 2: Update .env.example**

Find the line `STRIPE_PRICE_ID=price_...` and replace with:

```
STRIPE_PRICE_ID_MONTHLY=price_...
STRIPE_PRICE_ID_SEMESTER=price_...
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/stripe/checkout/route.ts .env.example
git commit -m "feat(api): support monthly/semester plan in stripe checkout"
```

---

### Task 3: Rewrite pricing page

**Files:**

- Modify: `src/app/(protected)/pricing/page.tsx` (full rewrite)
- Modify: `src/app/(protected)/pricing/loading.tsx` (update skeleton)

**Step 1: Rewrite pricing page**

Replace the entire file `src/app/(protected)/pricing/page.tsx` with:

```tsx
'use client';

import { Check, Crown, Sparkles } from 'lucide-react';
import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Group,
  List,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { PageShell } from '@/components/PageShell';
import { useProfile } from '@/context/ProfileContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';

type BillingCycle = 'monthly' | 'semester';

export default function PricingPage() {
  const { t } = useLanguage();
  const { profile } = useProfile();
  const [billing, setBilling] = useState<BillingCycle>('monthly');
  const [loading, setLoading] = useState(false);

  const isPro =
    profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: billing }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error) {
      showNotification({
        title: t.pricing.errorTitle,
        message: error instanceof Error ? error.message : 'An error occurred',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const proPrice =
    billing === 'semester' ? t.pricing.pro.priceSemester : t.pricing.pro.priceMonthly;
  const proPeriod =
    billing === 'semester' ? t.pricing.pro.periodSemester : t.pricing.pro.periodMonthly;

  return (
    <PageShell title={t.pricing.title} subtitle={t.pricing.subtitle}>
      {/* Billing Toggle */}
      <Box ta="center">
        <SegmentedControl
          value={billing}
          onChange={(v) => setBilling(v as BillingCycle)}
          data={[
            { label: t.pricing.monthly, value: 'monthly' },
            { label: t.pricing.semester, value: 'semester' },
          ]}
          radius="xl"
          size="md"
        />
        {billing === 'semester' && (
          <Badge color="green" variant="light" size="lg" mt="xs">
            {t.pricing.saveBadge}
          </Badge>
        )}
      </Box>

      {/* Plan Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        {/* Free Card */}
        {!isPro && (
          <Paper withBorder p="xl" radius="lg">
            <Stack gap="lg" justify="space-between" h="100%">
              <Stack gap="lg">
                <Box>
                  <Text fw={700} fz="lg">
                    {t.pricing.free.name}
                  </Text>
                  <Group align="baseline" gap={4} mt={4}>
                    <Text fz={36} fw={800} lh={1}>
                      {t.pricing.free.price}
                    </Text>
                  </Group>
                  <Text size="sm" c="dimmed" mt={4}>
                    {t.pricing.free.period}
                  </Text>
                </Box>

                <List
                  spacing="sm"
                  size="sm"
                  center
                  icon={
                    <ThemeIcon color="gray" size={20} radius="xl" variant="light">
                      <Check size={12} strokeWidth={3} />
                    </ThemeIcon>
                  }
                >
                  {t.pricing.free.features.map((feature, i) => (
                    <List.Item key={i}>
                      <Text size="sm">{feature}</Text>
                    </List.Item>
                  ))}
                </List>
              </Stack>

              <Button fullWidth variant="light" color="gray" radius="md" disabled>
                {t.pricing.free.cta}
              </Button>
            </Stack>
          </Paper>
        )}

        {/* Pro Card */}
        <Paper
          withBorder
          p="xl"
          radius="lg"
          style={{
            borderColor: 'var(--mantine-color-violet-4)',
            borderWidth: 2,
          }}
        >
          <Stack gap="lg" justify="space-between" h="100%">
            <Stack gap="lg">
              <Box>
                <Group gap="xs" mb={4}>
                  <ThemeIcon variant="light" color="violet" size="sm" radius="xl">
                    <Crown size={12} />
                  </ThemeIcon>
                  <Text fw={700} fz="lg">
                    {t.pricing.pro.name}
                  </Text>
                </Group>
                <Group align="baseline" gap={4} mt={4}>
                  <Text fz={36} fw={800} lh={1} c="violet.7">
                    {proPrice}
                  </Text>
                  <Text size="sm" c="dimmed" fw={500}>
                    {proPeriod}
                  </Text>
                </Group>
                {billing === 'semester' && (
                  <Text size="sm" c="dimmed" mt={4}>
                    <Text span td="line-through" c="dimmed">
                      {t.pricing.pro.originalPrice}
                    </Text>
                  </Text>
                )}
              </Box>

              <List
                spacing="sm"
                size="sm"
                center
                icon={
                  <ThemeIcon color="violet" size={20} radius="xl" variant="light">
                    <Check size={12} strokeWidth={3} />
                  </ThemeIcon>
                }
              >
                {t.pricing.pro.features.map((feature, i) => (
                  <List.Item key={i}>
                    <Text size="sm">{feature}</Text>
                  </List.Item>
                ))}
              </List>
            </Stack>

            {isPro ? (
              <Button fullWidth variant="light" color="gray" radius="md" disabled>
                {t.pricing.pro.currentPlan}
              </Button>
            ) : (
              <Button
                fullWidth
                color="violet"
                radius="md"
                size="md"
                onClick={handleUpgrade}
                loading={loading}
                leftSection={<Sparkles size={18} />}
              >
                {t.pricing.pro.cta}
              </Button>
            )}
          </Stack>
        </Paper>
      </SimpleGrid>

      {/* Footer */}
      <Text size="xs" c="dimmed" ta="center">
        {t.pricing.securePayment}
      </Text>
    </PageShell>
  );
}
```

**Step 2: Update loading skeleton**

Replace the entire file `src/app/(protected)/pricing/loading.tsx` with:

```tsx
import { Box, Container, SimpleGrid, Skeleton, Stack } from '@mantine/core';

export default function PricingLoading() {
  return (
    <Container size={700} py={60}>
      <Stack gap={40}>
        <Box>
          <Skeleton h={28} w={200} mb="xs" />
          <Skeleton h={16} w={350} />
        </Box>
        <Skeleton h={36} w={220} mx="auto" radius="xl" />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <Skeleton h={380} radius="lg" />
          <Skeleton h={380} radius="lg" />
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 5: Run build**

Run: `npm run build`
Expected: Builds successfully

**Step 6: Commit**

```bash
git add "src/app/(protected)/pricing/page.tsx" "src/app/(protected)/pricing/loading.tsx"
git commit -m "feat(ui): rewrite pricing page with free vs pro comparison"
```

---

### Task 4: Verify and update .env.local

**Step 1: Add new env vars to .env.local**

The user must manually add the Stripe Price IDs to `.env.local`:

```
STRIPE_PRICE_ID_MONTHLY=price_xxx  # Create in Stripe Dashboard
STRIPE_PRICE_ID_SEMESTER=price_yyy # Create in Stripe Dashboard
```

Note: The old `STRIPE_PRICE_ID` is no longer referenced. It can be removed from `.env.local`.

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 3: Manual test**

1. Start dev server: `npm run dev`
2. Visit `/pricing` — verify Free and Pro cards render
3. Toggle Monthly ↔ Semester — verify Pro price changes and Save 33% badge appears
4. Click "Upgrade Now" — verify Stripe Checkout redirect works (requires valid Price IDs)
5. Log in as Pro user — verify Pro card shows "Current Plan" (disabled) and Free card is hidden
