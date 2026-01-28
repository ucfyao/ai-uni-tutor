import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
    const body = await req.text()
    const headersList = await headers()
    const signature = headersList.get('Stripe-Signature') as string

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        )
    } catch (error: any) {
        return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 })
    }

    const session = event.data.object as Stripe.Checkout.Session

    const supabase = await createClient()

    if (event.type === 'checkout.session.completed') {
        const subscription = (await stripe.subscriptions.retrieve(
            session.subscription as string
        )) as any

        if (!session?.metadata?.userId) {
            return new NextResponse('User ID is required', { status: 400 })
        }

        await supabase
            .from('profiles')
            .update({
                stripe_subscription_id: subscription.id,
                stripe_customer_id: subscription.customer as string,
                subscription_status: subscription.status,
                current_period_end: new Date(
                    subscription.current_period_end * 1000
                ).toISOString(),
            })
            .eq('id', session.metadata.userId)
    }

    if (event.type === 'invoice.payment_succeeded') {
        const invoice = event.data.object as any
        const subscription = (await stripe.subscriptions.retrieve(
            invoice.subscription as string
        )) as any

        await supabase
            .from('profiles')
            .update({
                subscription_status: subscription.status,
                current_period_end: new Date(
                    subscription.current_period_end * 1000
                ).toISOString(),
            })
            .eq('stripe_subscription_id', subscription.id)
    }

    if (event.type === 'customer.subscription.updated') {
        const subscription = event.data.object as any

        await supabase
            .from('profiles')
            .update({
                subscription_status: subscription.status,
                current_period_end: new Date(
                    subscription.current_period_end * 1000
                ).toISOString(),
                stripe_price_id: subscription.items.data[0].price.id,
            })
            .eq('stripe_subscription_id', subscription.id)
    }

    if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as any

        await supabase
            .from('profiles')
            .update({
                subscription_status: 'canceled', // or subscription.status which should be 'canceled'
                current_period_end: new Date().toISOString(), // Expire immediately or keep until period end? Usually deleted means gone.
            })
            .eq('stripe_subscription_id', subscription.id)
    }

    return new NextResponse(null, { status: 200 })
}
