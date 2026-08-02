import type { Express, Request, Response } from 'express';
import { applyPaymentResultToOrder, findOrderIdForPaymentResult, getMfSettings, mapMyFatoorahWebhookToResult, verifyMyFatoorahWebhookSignature } from './payment';

export function registerPaymentRoutes(app: Express) {
  app.post('/api/payments/myfatoorah/webhook', async (req: Request, res: Response) => {
    try {
      const settings = await getMfSettings();
      if (!settings.webhookSecret) return res.status(400).json({ ok: false, message: 'Webhook secret is not configured' });
      const valid = verifyMyFatoorahWebhookSignature({
        payload: req.body,
        signature: req.headers['myfatoorah-signature'],
        version: req.headers['myfatoorah-webhook-version'],
        secret: settings.webhookSecret,
      });
      if (!valid) return res.status(401).json({ ok: false, message: 'Invalid signature' });

      const mapped = mapMyFatoorahWebhookToResult(req.body);
      const orderId = mapped.orderId ?? await findOrderIdForPaymentResult(mapped.result);
      if (!orderId) return res.status(400).json({ ok: false, message: 'Missing order identifier' });
      const updated = await applyPaymentResultToOrder(orderId, mapped.result);
      return res.json({ ok: true, orderId, invoiceId: mapped.result.invoiceId, status: updated.status });
    } catch (err: any) {
      console.error('[MyFatoorah webhook]', err?.message || err);
      return res.status(400).json({ ok: false, message: err?.message || 'Webhook failed' });
    }
  });
}
