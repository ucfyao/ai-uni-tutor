---
description: Stripe payment integration standards
globs: src/app/api/stripe/**/*.ts, src/lib/stripe.ts
---

# Stripe Integration Standards

## Architecture

```
User → Checkout Route → Stripe Checkout → Webhook → Database Update
```

## Checkout Flow

### Create Checkout Session

```typescript
// src/app/api/stripe/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  // 1. Authenticate user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Get or create Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  let customerId = profile?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id }
    })
    customerId = customer.id

    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  // 3. Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{
      price: process.env.STRIPE_PRO_PRICE_ID,
      quantity: 1
    }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
    metadata: {
      user_id: user.id
    }
  })

  return NextResponse.json({ url: session.url })
}
```

## Webhook Handling

### Webhook Route

```typescript
// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

// Use service role for webhook (no user context)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  // 1. Verify webhook signature
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // 2. Handle events
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object)
        break
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object)
        break
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object)
        break
      
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 })
  }
}
```

### Event Handlers

```typescript
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id
  const subscriptionId = session.subscription as string

  if (!userId) {
    throw new Error('Missing user_id in session metadata')
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  await supabase
    .from('profiles')
    .update({
      subscription_status: 'pro',
      stripe_subscription_id: subscriptionId,
      stripe_price_id: subscription.items.data[0].price.id,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
    })
    .eq('id', userId)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!profile) {
    throw new Error(`No profile found for customer: ${customerId}`)
  }

  const status = subscription.status === 'active' ? 'pro' : 'free'

  await supabase
    .from('profiles')
    .update({
      subscription_status: status,
      stripe_price_id: subscription.items.data[0].price.id,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
    })
    .eq('id', profile.id)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  await supabase
    .from('profiles')
    .update({
      subscription_status: 'free',
      stripe_subscription_id: null,
      current_period_end: null
    })
    .eq('stripe_customer_id', customerId)
}
```

## Environment Variables

```bash
# Required
STRIPE_SECRET_KEY=sk_live_...        # or sk_test_... for development
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...

# Optional
STRIPE_PUBLISHABLE_KEY=pk_live_...   # For client-side Stripe.js
```

## Testing Webhooks

### Local Development

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login and forward webhooks
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### Test Events

```bash
# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

## Security Checklist

| Check | Required |
|-------|----------|
| Verify webhook signatures | Yes |
| Use HTTPS in production | Yes |
| Store secrets in env vars | Yes |
| Validate user before checkout | Yes |
| Log webhook events | Yes |
| Handle all subscription states | Yes |
| Use idempotency keys for retries | Recommended |

## Common Patterns

### Check Subscription Status

```typescript
export async function isPro(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('subscription_status, current_period_end')
    .eq('id', userId)
    .single()

  if (!data) return false
  
  // Check if subscription is active and not expired
  if (data.subscription_status !== 'pro') return false
  if (data.current_period_end && new Date(data.current_period_end) < new Date()) {
    return false
  }
  
  return true
}
```

### Customer Portal

```typescript
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user!.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'No subscription' }, { status: 400 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`
  })

  return NextResponse.json({ url: session.url })
}
```

## Anti-Patterns

- Never log full webhook payloads (may contain PII)
- Never skip signature verification
- Never trust client-side subscription status
- Never hardcode price IDs in code
- Never use test keys in production
