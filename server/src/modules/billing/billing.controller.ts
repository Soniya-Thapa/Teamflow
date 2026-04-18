import { Request, Response } from 'express';
import { BaseController } from '@/common/BaseController';
import billingService from './billing.service';

class BillingController extends BaseController {
  createCheckoutSession = this.asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const userId = req.userId!;
    const { plan } = req.body;

    const result = await billingService.createCheckoutSession(
      organizationId,
      userId,
      plan,
    );

    return this.sendSuccess(res, result, 'Checkout session created');
  });

  getBillingInfo = this.asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const result = await billingService.getBillingInfo(organizationId);
    return this.sendSuccess(res, result, 'Billing info retrieved');
  });

  webhook = async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    try {
      const result = await billingService.handleWebhook(
        req.body as Buffer,
        signature,
      );
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };
}

export default new BillingController();