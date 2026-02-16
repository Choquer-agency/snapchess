import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { StripeService } from '../services/StripeService';
import { prisma } from '../config/database';
import { env } from '../config/env';

const router = Router();

router.post('/checkout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { interval } = req.body; // 'monthly' or 'annual'
    const priceId =
      interval === 'annual'
        ? env.STRIPE_PRO_ANNUAL_PRICE_ID
        : env.STRIPE_PRO_MONTHLY_PRICE_ID;

    if (!priceId) {
      return res.status(500).json({ success: false, error: 'Stripe not configured' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const url = await StripeService.createCheckoutSession({
      userId: req.userId,
      email: user.email,
      priceId,
      successUrl: `${env.FRONTEND_URL}/subscription?success=true`,
      cancelUrl: `${env.FRONTEND_URL}/pricing`,
    });

    return res.json({ success: true, data: { url } });
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create checkout session' });
  }
});

router.post('/portal', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const url = await StripeService.createPortalSession(
      req.userId,
      `${env.FRONTEND_URL}/subscription`,
    );

    return res.json({ success: true, data: { url } });
  } catch (error) {
    console.error('Portal error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create portal session' });
  }
});

// Get subscription status
router.get('/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { subscription: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({
      success: true,
      data: {
        tier: user.tier,
        subscription: user.subscription
          ? {
              status: user.subscription.status,
              billingInterval: user.subscription.billingInterval,
              currentPeriodEnd: user.subscription.currentPeriodEnd,
              cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
