import { Router, Request, Response } from 'express';
import express from 'express';
import { StripeService } from '../services/StripeService';

const router = Router();

// Stripe webhook needs raw body
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    try {
      await StripeService.handleWebhookEvent(req.body, signature);
      return res.json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      return res.status(400).json({ error: 'Webhook handling failed' });
    }
  },
);

export default router;
