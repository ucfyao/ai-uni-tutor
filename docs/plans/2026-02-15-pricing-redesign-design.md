# Pricing Page Redesign

## Goal

Restructure the pricing page from placeholder course cards to a functional subscription-based pricing page with Free vs Pro comparison, monthly/semester billing toggle, and live Stripe checkout integration.

## Pricing Model

| Plan         | Price                    | Positioning                           |
| ------------ | ------------------------ | ------------------------------------- |
| Free         | $0                       | 3 conversations/day, experience value |
| Pro Monthly  | $9.99/month              | Unlimited conversations + KB + exams  |
| Pro Semester | $39.99/semester (~$8/mo) | Lock in long-term users               |

Pricing logic: below ChatGPT Plus ($20), same tier as Course Hero but stronger (AI conversations vs static question bank), low decision cost for international students.

## Page Layout

```
PageShell (title + subtitle)
  SegmentedControl [Monthly | Semester] — centered
    "Save 33%" Badge (shown when Semester selected)
  SimpleGrid 2 cols
    Free Card (standard border)
      $0 / Free forever
      ✓ 3 AI conversations/day
      ✓ Basic document upload (5MB)
      ✓ Lecture Helper mode
      ✓ Assignment Coach mode
      CTA: "Current Plan" (gray, disabled)
    Pro Card (violet border highlight)
      $9.99/mo or $39.99/semester (toggles with SegmentedControl)
      Strikethrough $59.94 + "Save 33%" when semester selected
      ✓ Unlimited AI conversations
      ✓ Unlimited document uploads
      ✓ Advanced RAG hybrid search
      ✓ All tutoring modes
      ✓ Mock exams with scoring
      ✓ Priority AI processing
      ✓ Priority support
      CTA: "Upgrade Now" (violet, filled) → Stripe Checkout
  Footer: "Secure payment via Stripe."
```

## CTA Button States

| User Status | Free Card                       | Pro Card                        |
| ----------- | ------------------------------- | ------------------------------- |
| Free user   | "Current Plan" (gray, disabled) | "Upgrade Now" (violet) → Stripe |
| Pro user    | hidden                          | "Current Plan" (gray, disabled) |

## Billing Toggle

- SegmentedControl with two options: Monthly / Semester
- Default: Monthly
- Switching only affects Pro card price and CTA target
- Semester shows strikethrough of 6-month monthly total ($59.94) + Save 33% badge

## API Changes

### `POST /api/stripe/checkout`

Add `plan` parameter to request body:

```ts
body: {
  plan: 'monthly' | 'semester';
}
```

- `monthly` → uses `STRIPE_PRICE_ID_MONTHLY`
- `semester` → uses `STRIPE_PRICE_ID_SEMESTER`
- Default (no body / missing plan): `monthly` for backward compatibility

### Environment Variables

```
STRIPE_PRICE_ID_MONTHLY=price_xxx
STRIPE_PRICE_ID_SEMESTER=price_yyy
```

## What Doesn't Change

- Stripe webhook route (already handles all subscription events)
- Settings page Plan & Billing section (already displays subscription status)
- Sidebar "Upgrade Plan" entry (already conditionally shown for free users)

## i18n

Replace existing `pricing` translation block. Remove course-related keys, add subscription keys for both zh and en.

## Removed from Previous Design

- Course pricing cards (placeholder "Course A", "Course B")
- Partner Program entry on pricing page (stays only on /personalization)
