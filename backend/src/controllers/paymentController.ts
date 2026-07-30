import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { initializePaystackTransaction } from '../services/paystackService';

const prisma = new PrismaClient();

/**
 * POST /api/payments/initialize
 *
 * Initializes a Paystack transaction for a given service price.
 * Returns { access_code, reference, authorization_url } to the frontend,
 * which uses the access_code to launch the Paystack inline popup.
 *
 * Body: { serviceId: string, providerId: string }
 */
export async function initializePayment(req: AuthenticatedRequest, res: Response) {
  const customerId = req.user?.id;
  if (!customerId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { serviceId, providerId } = req.body;

  if (!serviceId || !providerId) {
    return res.status(400).json({ error: 'serviceId and providerId are required' });
  }

  try {
    // Fetch customer email
    const customer = await prisma.user.findUnique({
      where: { id: customerId },
      select: { email: true, name: true },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Fetch service for price
    const service = await prisma.service.findFirst({
      where: { id: serviceId, providerId },
      select: { name: true, price: true },
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const amountInKobo = Math.round(Number(service.price) * 100);

    // Generate a unique reference
    const reference = `BF-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    const result = await initializePaystackTransaction({
      email: customer.email,
      amount: amountInKobo,
      reference,
      metadata: {
        custom_fields: [
          {
            display_name: 'Service',
            variable_name: 'service_name',
            value: service.name,
          },
          {
            display_name: 'Customer',
            variable_name: 'customer_name',
            value: customer.name,
          },
        ],
      },
    });

    if (!result.status) {
      return res.status(502).json({ error: 'Failed to initialize payment with Paystack' });
    }

    return res.json({
      access_code: result.data.access_code,
      reference: result.data.reference,
      authorization_url: result.data.authorization_url,
    });
  } catch (err: any) {
    console.error('[Payment Init Error]', err?.response?.data || err.message);
    return res.status(500).json({ error: 'Payment initialization failed' });
  }
}
