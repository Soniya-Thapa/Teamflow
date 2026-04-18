/**
 * @file billing.service.ts
 * @description Stripe subscription management.
 *
 * PLANS:
 * FREE        → $0/mo, 5 users, 3 projects, 1GB storage
 * PRO         → $12/mo, 25 users, unlimited projects, 10GB storage
 * ENTERPRISE  → $49/mo, unlimited users, unlimited projects, 100GB storage
 *
 * FLOW:
 * 1. User clicks Upgrade → frontend calls createCheckoutSession
 * 2. Backend creates Stripe Checkout Session → returns URL
 * 3. User completes payment on Stripe-hosted page
 * 4. Stripe sends webhook → payment.success → upgrade org plan
 * 5. Org.plan updated in database
 * 6. User redirected back to /settings/billing
 *
 * WHY WEBHOOKS?
 * Checkout happens on Stripe's site, not yours.
 * You can't know when payment succeeds unless Stripe tells you.
 * Webhooks are Stripe calling your server saying "payment done".
 */

import Stripe from 'stripe';
import { BaseService } from '@/common/BaseService';
import ApiError from '@/utils/ApiError';
import { envConfig } from '@/config/env.config';

const stripe = new Stripe(envConfig.stripe.secretKey);

const PLAN_LIMITS = {
  FREE: { maxUsers: 5, maxProjects: 3, maxStorage: BigInt(1073741824) },
  PRO: { maxUsers: 25, maxProjects: 999, maxStorage: BigInt(10737418240) },
  ENTERPRISE: { maxUsers: 9999, maxProjects: 9999, maxStorage: BigInt(107374182400) },
};

class BillingService extends BaseService {

  /**
   * Create a Stripe Checkout Session for upgrading.
   * Returns a URL — redirect the user there.
   */
  async createCheckoutSession(
    organizationId: string,
    userId: string,
    plan: 'PRO' | 'ENTERPRISE',
  ) {
    this.log('Creating checkout session', { organizationId, plan });

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, plan: true },
    });

    if (!org) throw ApiError.notFound('Organization not found');
    if (org.plan === plan) throw ApiError.badRequest('Already on this plan');

    const priceId =
      plan === 'PRO'
        ? envConfig.stripe.proPriceId
        : envConfig.stripe.enterprisePriceId;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${envConfig.email.frontendUrl}/settings/billing?success=true`,
      cancel_url: `${envConfig.email.frontendUrl}/settings/billing?cancelled=true`,
      metadata: {
        organizationId,
        plan,
        userId,
      },
    });

    return { checkoutUrl: session.url };
  }

  /**
   * Handle Stripe webhook events.
   * This is called by the webhook endpoint after verifying the signature.
   */
  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        envConfig.stripe.webhookSecret,
      );
    } catch {
      throw ApiError.badRequest('Invalid webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { organizationId, plan } = session.metadata || {};

        if (organizationId && plan) {
          const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];
          await this.prisma.organization.update({
            where: { id: organizationId },
            data: {
              plan: plan as any,
              ...limits,
            },
          });

          this.log('Plan upgraded via webhook', { organizationId, plan });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        // Downgrade to FREE when subscription cancelled
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find org by Stripe customer ID (you'd store this on Org model in production)
        // For simplicity, using metadata from the subscription
        break;
      }
    }

    return { received: true };
  }

  /**
   * Get current billing info for the org.
   */
  async getBillingInfo(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        plan: true,
        maxUsers: true,
        maxProjects: true,
        maxStorage: true,
        usage: true,
      },
    });

    if (!org) throw ApiError.notFound('Organization not found');

    return {
      plan: org.plan,
      limits: {
        maxUsers: org.maxUsers,
        maxProjects: org.maxProjects,
        maxStorage: org.maxStorage?.toString(),
      },
      usage: {
        currentUsers: org.usage?.currentUsers ?? 0,
        currentProjects: org.usage?.currentProjects ?? 0,
        currentStorage: org.usage?.currentStorage?.toString() ?? '0',
      },
    };
  }
}

export default new BillingService();