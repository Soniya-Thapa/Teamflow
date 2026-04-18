import { Router } from 'express';
import express from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { requireOrganization } from '@/middleware/tenant.middleware';
import billingController from './billing.controller';

const router = Router({ mergeParams: true });

// Webhook must use raw body — must be BEFORE json parsing middleware
export const webhookRouter = Router();
webhookRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  billingController.webhook,
);

router.use(authenticate, requireOrganization);
router.get('/info', billingController.getBillingInfo);
router.post('/checkout', billingController.createCheckoutSession);

export default router;