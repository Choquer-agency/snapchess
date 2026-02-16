import Stripe from 'stripe';
import { env } from '../config/env';
import { prisma } from '../config/database';

const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

export class StripeService {
  static async createCheckoutSession(params: {
    userId: string;
    email: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<string> {
    // Get or create Stripe customer
    let user = await prisma.user.findUnique({ where: { id: params.userId } });
    if (!user) throw new Error('User not found');

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: params.email,
        metadata: { userId: params.userId },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: params.userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: params.priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: { userId: params.userId },
    });

    return session.url!;
  }

  static async createPortalSession(userId: string, returnUrl: string): Promise<string> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.stripeCustomerId) throw new Error('No Stripe customer found');

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return session.url;
  }

  static async handleWebhookEvent(body: Buffer, signature: string) {
    const event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.handleCheckoutComplete(session);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionUpdate(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionDeleted(subscription);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.handlePaymentFailed(invoice);
        break;
      }
    }
  }

  private static async handleCheckoutComplete(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    if (!userId || !session.subscription) return;

    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    const priceId = subscription.items.data[0]?.price.id;

    const billingInterval =
      priceId === env.STRIPE_PRO_ANNUAL_PRICE_ID ? 'ANNUAL' : 'MONTHLY';

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { tier: 'PRO' },
      }),
      prisma.subscription.upsert({
        where: { userId },
        update: {
          stripeSubscriptionId: subscription.id,
          status: 'ACTIVE',
          billingInterval: billingInterval as any,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: false,
        },
        create: {
          userId,
          stripeSubscriptionId: subscription.id,
          status: 'ACTIVE',
          billingInterval: billingInterval as any,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        },
      }),
    ]);

    // Track event
    await prisma.event.create({
      data: { userId, type: 'subscription_created', data: { billingInterval } },
    });
  }

  private static async handleSubscriptionUpdate(subscription: Stripe.Subscription) {
    const sub = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (!sub) return;

    const status = subscription.status === 'active'
      ? 'ACTIVE'
      : subscription.status === 'past_due'
        ? 'PAST_DUE'
        : 'CANCELED';

    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: status as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });

    // Update user tier
    const tier = status === 'ACTIVE' ? 'PRO' : 'FREE';
    await prisma.user.update({
      where: { id: sub.userId },
      data: { tier: tier as any },
    });
  }

  private static async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const sub = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (!sub) return;

    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'EXPIRED' },
      }),
      prisma.user.update({
        where: { id: sub.userId },
        data: { tier: 'FREE' },
      }),
    ]);

    await prisma.event.create({
      data: { userId: sub.userId, type: 'subscription_canceled' },
    });
  }

  private static async handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (user) {
      await prisma.event.create({
        data: { userId: user.id, type: 'payment_failed', data: { invoiceId: invoice.id } },
      });
    }
  }
}
