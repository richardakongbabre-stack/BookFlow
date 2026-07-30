import { Response } from 'express';
import { z } from 'zod';
import { PrismaClient, BookingStatus, Role } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { getAvailableSlots } from '../services/scheduleService';
import { processBookingPayment } from '../services/paymentService';
import { sendEmail, sendSMS } from '../services/notificationService';

const prisma = new PrismaClient();

// Validation schemas
export const getAvailabilitySchema = z.object({
  query: z.object({
    providerSlug: z.string().min(1, 'Provider slug is required'),
    staffId: z.string().uuid('Invalid staff UUID'),
    serviceId: z.string().uuid('Invalid service UUID'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in format YYYY-MM-DD'),
  }),
});

export const createBookingSchema = z.object({
  body: z.object({
    providerId: z.string().uuid('Invalid provider UUID'),
    staffId: z.string().uuid('Invalid staff UUID'),
    serviceId: z.string().uuid('Invalid service UUID'),
    startTime: z.string().datetime('Start time must be a valid ISO datetime string'),
    notes: z.string().optional(),
    paystackReference: z.string().min(1, 'Paystack payment reference is required'),
  }),
});

/**
 * Public: Query available time slots.
 */
export async function getAvailability(req: AuthenticatedRequest, res: Response) {
  const { providerSlug, staffId, serviceId, date } = req.query as {
    providerSlug: string;
    staffId: string;
    serviceId: string;
    date: string;
  };

  try {
    const provider = await prisma.provider.findUnique({
      where: { slug: providerSlug },
      select: { id: true },
    });

    if (!provider) {
      return res.status(404).json({ error: 'Business provider not found' });
    }

    const slots = await getAvailableSlots(provider.id, staffId, serviceId, date);
    return res.json(slots);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to calculate availability' });
  }
}

/**
 * Authenticated Customer: Book a slot and process transaction payment.
 */
export async function createBooking(req: AuthenticatedRequest, res: Response) {
  const { providerId, staffId, serviceId, startTime, notes, paystackReference } = req.body;
  const customerId = req.user?.id;

  if (!customerId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // 1. Fetch provider details and check subscription caps
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      return res.status(404).json({ error: 'Business provider not found' });
    }

    if (provider.subStatus !== 'ACTIVE') {
      return res.status(403).json({ error: 'This business has suspended online scheduling' });
    }

    // Free Tier restriction: Cap at 30 bookings per calendar month
    if (provider.subscriptionPlan === 'FREE') {
      const now = new Date();
      const startOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
      const endOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999);

      const bookingsThisMonth = await prisma.booking.count({
        where: {
          providerId,
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      });

      if (bookingsThisMonth >= 30) {
        return res.status(403).json({
          error: 'This business has reached the booking limit for its Free subscription tier. They need to upgrade to accept more appointments.',
        });
      }
    }

    // 2. Fetch service & staff details to ensure validity
    const service = await prisma.service.findFirst({
      where: { id: serviceId, providerId },
    });
    if (!service) {
      return res.status(404).json({ error: 'Service not found under this business' });
    }

    const staff = await prisma.staff.findFirst({
      where: { id: staffId, providerId },
      include: {
        user: { select: { email: true, phone: true } },
      },
    });
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found under this business' });
    }

    // Calculate end time
    const start = new Date(startTime);
    const end = new Date(start.getTime() + service.duration * 60 * 1000);

    // Verify slot is actually available
    const dateStr = start.toISOString().substring(0, 10);
    const availableSlots = await getAvailableSlots(providerId, staffId, serviceId, dateStr);
    const isSlotValid = availableSlots.some((slot) => slot.dateTimeISO === start.toISOString());

    if (!isSlotValid) {
      return res.status(400).json({ error: 'The selected time slot is no longer available' });
    }

    // 3. Create Pending Booking
    const booking = await prisma.booking.create({
      data: {
        providerId,
        customerId,
        staffId,
        serviceId,
        startTime: start,
        endTime: end,
        status: BookingStatus.PENDING,
        totalAmount: service.price,
        notes,
      },
    });

    // 4. Verify Paystack payment
    const paymentResult = await processBookingPayment(booking.id, paystackReference);

    if (!paymentResult.success) {
      return res.status(400).json({
        error: 'Payment declined. Booking cancelled.',
        payment: paymentResult,
      });
    }

    // Fetch customer details for notifications
    const customer = await prisma.user.findUnique({
      where: { id: customerId },
    });

    if (customer) {
      // 5. Send mock notifications
      const emailBody = `Hi ${customer.name}, your appointment with ${staff.name} at ${provider.name} for "${service.name}" on ${start.toUTCString()} is confirmed!`;
      await sendEmail(customer.id, {
        to: customer.email,
        subject: `Booking Confirmed - ${provider.name}`,
        body: emailBody,
      });

      // Send SMS to staff member (SMS alerts)
      if (staff.user.phone) {
        const smsMessage = `New booking alert: ${customer.name} has scheduled "${service.name}" on ${start.toUTCString()}`;
        await sendSMS(staff.userId, {
          to: staff.user.phone,
          message: smsMessage,
          providerId,
        });
      }
    }

    return res.status(201).json({
      message: 'Booking created and paid successfully',
      booking,
      payment: paymentResult,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error during booking checkout' });
  }
}

/**
 * List bookings based on role boundaries (tenant-isolated for provider/staff, customer-isolated for users).
 */
export async function getBookings(req: AuthenticatedRequest, res: Response) {
  const role = req.user?.role;
  const userId = req.user?.id;

  try {
    if (role === Role.PLATFORM_ADMIN) {
      // Super admin can read everything
      const bookings = await prisma.booking.findMany({
        include: {
          provider: { select: { name: true } },
          customer: { select: { name: true, email: true } },
          staff: { select: { name: true } },
          service: { select: { name: true } },
        },
        orderBy: { startTime: 'desc' },
      });
      return res.json(bookings);
    }

    if (role === Role.PROVIDER_ADMIN || role === Role.STAFF) {
      const providerId = req.tenantId;
      if (!providerId) {
        return res.status(403).json({ error: 'Access Denied: Missing provider association' });
      }

      // Filter by tenant
      const bookings = await prisma.booking.findMany({
        where: { providerId },
        include: {
          customer: { select: { name: true, email: true, phone: true } },
          staff: { select: { name: true, title: true } },
          service: { select: { name: true, duration: true, price: true } },
          payments: true,
        },
        orderBy: { startTime: 'desc' },
      });
      return res.json(bookings);
    }

    // Role is CUSTOMER: return their own bookings
    const bookings = await prisma.booking.findMany({
      where: { customerId: userId },
      include: {
        provider: { select: { name: true, slug: true, address: true } },
        staff: { select: { name: true, title: true } },
        service: { select: { name: true, duration: true, price: true } },
        payments: true,
      },
      orderBy: { startTime: 'desc' },
    });
    return res.json(bookings);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch bookings' });
  }
}

/**
 * Cancel a booking.
 */
export async function cancelBooking(req: AuthenticatedRequest, res: Response) {
  const { bookingId } = req.params;
  const role = req.user?.role;
  const userId = req.user?.id;

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { provider: true, customer: true },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Enforce tenant boundary: customer can cancel their own, provider staff can cancel their tenant's
    if (role === Role.CUSTOMER && booking.customerId !== userId) {
      return res.status(403).json({ error: 'You are not authorized to cancel this booking' });
    }

    if ((role === Role.PROVIDER_ADMIN || role === Role.STAFF) && booking.providerId !== req.tenantId) {
      return res.status(403).json({ error: 'Access Denied: Tenant mismatch' });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED },
    });

    // Notify customer
    await sendEmail(booking.customerId, {
      to: booking.customer.email,
      subject: `Booking Cancelled - ${booking.provider.name}`,
      body: `Your booking scheduled on ${booking.startTime.toUTCString()} has been cancelled.`,
    });

    return res.json({ message: 'Booking cancelled successfully', booking: updatedBooking });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to cancel booking' });
  }
}
