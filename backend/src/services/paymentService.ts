import { PrismaClient, PaymentStatus, BookingStatus } from '@prisma/client';
import { verifyPaystackTransaction } from './paystackService';

const prisma = new PrismaClient();

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  amount: number;
  platformCommission: number;
  providerShare: number;
  status: PaymentStatus;
  transactionId: string | null;
  gateway: string;
}

/**
 * Verifies a Paystack payment reference and, if successful, records the
 * payment and updates the booking status accordingly.
 *
 * Commission split is based on the provider's subscription plan:
 *   FREE           → 0%
 *   STARTER        → 5%
 *   PROFESSIONAL   → 5%
 *   ENTERPRISE     → 3%
 */
export async function processBookingPayment(
  bookingId: string,
  paystackReference: string
): Promise<PaymentResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { provider: true },
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  const amount = Number(booking.totalAmount);
  const provider = booking.provider;

  // Resolve commission rate
  let commissionRate = 0.05;
  if (provider.subscriptionPlan === 'FREE') commissionRate = 0.0;
  else if (provider.subscriptionPlan === 'ENTERPRISE') commissionRate = 0.03;

  const platformCommission = amount * commissionRate;
  const providerShare = amount - platformCommission;

  // --- Real Paystack verification ---
  let paymentStatus: PaymentStatus = PaymentStatus.FAILED;
  let transactionId: string | null = null;

  try {
    const verification = await verifyPaystackTransaction(paystackReference);

    if (
      verification.status &&
      verification.data?.status === 'success'
    ) {
      // Paystack amounts are in kobo; convert and compare (allow ±1 tolerance)
      const paystackAmountInMajor = verification.data.amount / 100;
      if (Math.abs(paystackAmountInMajor - amount) <= 1) {
        paymentStatus = PaymentStatus.SUCCESSFUL;
        transactionId = verification.data.reference;
      } else {
        console.warn(
          `[Payment] Amount mismatch: expected ${amount}, got ${paystackAmountInMajor}`
        );
        paymentStatus = PaymentStatus.FAILED;
      }
    }
  } catch (err: any) {
    console.error('[Payment] Paystack verification error:', err?.response?.data || err.message);
    paymentStatus = PaymentStatus.FAILED;
  }

  // Record payment
  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      providerId: provider.id,
      amount,
      providerShare,
      platformCommission,
      status: paymentStatus,
      transactionId,
      gateway: 'PAYSTACK',
    },
  });

  // Update booking status
  if (paymentStatus === PaymentStatus.SUCCESSFUL) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CONFIRMED,
        commissionAmount: platformCommission,
      },
    });
  } else {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED },
    });
  }

  return {
    success: paymentStatus === PaymentStatus.SUCCESSFUL,
    paymentId: payment.id,
    amount,
    platformCommission,
    providerShare,
    status: paymentStatus,
    transactionId,
    gateway: 'PAYSTACK',
  };
}
