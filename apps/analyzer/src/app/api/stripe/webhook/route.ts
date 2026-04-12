import { NextRequest, NextResponse } from 'next/server'
import { stripe, PLANS, getPlanByPriceId } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-server'
import type Stripe from 'stripe'

export const dynamic = 'force-dynamic'

async function getUserIdFromCustomer(customerId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('user_profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()
  return data?.id ?? null
}

async function applySubscription(userId: string, subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id
  const plan = getPlanByPriceId(priceId)
  if (!plan) return

  const credits = PLANS[plan].credits
  const periodEnd = new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000).toISOString()

  await supabaseAdmin
    .from('user_profiles')
    .update({
      plan,
      credits_remaining: credits,
      credits_monthly: credits,
      stripe_subscription_id: subscription.id,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.supabase_user_id
      if (!userId || session.mode !== 'subscription') break

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
      await applySubscription(userId, subscription)
      break
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
      if (!customerId) break

      const userId = await getUserIdFromCustomer(customerId)
      if (!userId) break

      // Reset credits at start of new billing period
      const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null
      if (!subscriptionId) break

      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      await applySubscription(userId, subscription)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id
      if (!customerId) break

      const userId = await getUserIdFromCustomer(customerId)
      if (!userId) break

      await supabaseAdmin
        .from('user_profiles')
        .update({
          plan: 'free',
          credits_remaining: 0,
          credits_monthly: 3,
          stripe_subscription_id: null,
          current_period_end: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
      break
    }
  }

  return NextResponse.json({ received: true })
}
