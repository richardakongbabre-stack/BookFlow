import { Response } from 'express';
import { PrismaClient, Role, SubscriptionPlan } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';

const prisma = new PrismaClient();

/**
 * Platform Admin: Fetch system-wide statistics (tenants, subscriptions, total platform commission).
 */
export async function getPlatformDashboard(req: AuthenticatedRequest, res: Response) {
  try {
    // 1. Total counts
    const totalProviders = await prisma.provider.count();
    const totalCustomers = await prisma.user.count({ where: { role: Role.CUSTOMER } });
    const totalBookings = await prisma.booking.count();

    // 2. Subscription plans breakdown
    const subscriptionBreakdown = await prisma.provider.groupBy({
      by: ['subscriptionPlan'],
      _count: {
        id: true,
      },
    });

    // 3. Platform financial aggregation
    const financialStats = await prisma.payment.aggregate({
      where: { status: 'SUCCESSFUL' },
      _sum: {
        amount: true,
        platformCommission: true,
        providerShare: true,
      },
    });

    // 4. Retrieve recent activity audit logs
    const auditLogs = await prisma.auditLog.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    // 5. Retrieve list of all providers with their plans and statuses
    const providersList = await prisma.provider.findMany({
      include: {
        _count: {
          select: { staff: true, services: true, bookings: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      summary: {
        totalProviders,
        totalCustomers,
        totalBookings,
        grossVolume: financialStats._sum.amount || 0,
        platformEarnings: financialStats._sum.platformCommission || 0,
        providerEarnings: financialStats._sum.providerShare || 0,
      },
      subscriptions: subscriptionBreakdown.map((s) => ({
        plan: s.subscriptionPlan,
        count: s._count.id,
      })),
      providers: providersList.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        subscriptionPlan: p.subscriptionPlan,
        status: p.subStatus,
        staffCount: p._count.staff,
        servicesCount: p._count.services,
        bookingsCount: p._count.bookings,
        createdAt: p.createdAt,
      })),
      recentLogs: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        user: log.user ? `${log.user.name} (${log.user.email})` : 'System',
        details: log.details,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to aggregate platform metrics' });
  }
}

/**
 * Provider Admin / Staff: Retrieve business dashboard statistics (net earnings, service counts, booking schedules).
 */
export async function getProviderDashboard(req: AuthenticatedRequest, res: Response) {
  const providerId = req.tenantId;

  if (!providerId) {
    return res.status(403).json({ error: 'Access Denied: Missing provider context' });
  }

  try {
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      include: {
        _count: {
          select: { staff: true, services: true },
        },
      },
    });

    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    // 1. Booking counts
    const totalBookings = await prisma.booking.count({ where: { providerId } });
    const pendingBookings = await prisma.booking.count({ where: { providerId, status: 'PENDING' } });
    const confirmedBookings = await prisma.booking.count({ where: { providerId, status: 'CONFIRMED' } });
    const completedBookings = await prisma.booking.count({ where: { providerId, status: 'COMPLETED' } });
    const cancelledBookings = await prisma.booking.count({ where: { providerId, status: 'CANCELLED' } });

    // 2. Earnings aggregation (net provider share)
    const earningsStats = await prisma.payment.aggregate({
      where: {
        providerId,
        status: 'SUCCESSFUL',
      },
      _sum: {
        amount: true,
        providerShare: true,
        platformCommission: true,
      },
    });

    // 3. Current calendar month bookings count (for Free tier cap tracking)
    const now = new Date();
    const startOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const endOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999);

    const monthBookings = await prisma.booking.count({
      where: {
        providerId,
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    // 4. Popular services count
    const popularServices = await prisma.booking.groupBy({
      by: ['serviceId'],
      where: { providerId, status: 'CONFIRMED' },
      _count: {
        id: true,
      },
    });

    const services = await prisma.service.findMany({
      where: { providerId },
      select: { id: true, name: true, price: true },
    });

    const servicePopularity = popularServices.map((group) => {
      const match = services.find((s) => s.id === group.serviceId);
      return {
        name: match ? match.name : 'Unknown Service',
        bookingsCount: group._count.id,
        revenue: (match ? Number(match.price) : 0) * group._count.id,
      };
    }).sort((a, b) => b.bookingsCount - a.bookingsCount);

    // 5. Popular staff count
    const popularStaff = await prisma.booking.groupBy({
      by: ['staffId'],
      where: { providerId, status: 'CONFIRMED' },
      _count: {
        id: true,
      },
    });

    const staffMembers = await prisma.staff.findMany({
      where: { providerId },
      select: { id: true, name: true, title: true },
    });

    const staffPerformance = popularStaff.map((group) => {
      const match = staffMembers.find((s) => s.id === group.staffId);
      return {
        name: match ? match.name : 'Unknown Staff',
        title: match ? match.title : '',
        bookingsCount: group._count.id,
      };
    }).sort((a, b) => b.bookingsCount - a.bookingsCount);

    return res.json({
      providerInfo: {
        name: provider.name,
        subscriptionPlan: provider.subscriptionPlan,
        status: provider.subStatus,
        staffCount: provider._count.staff,
        servicesCount: provider._count.services,
        commissionRate: provider.commissionRate,
      },
      summary: {
        totalBookings,
        pendingBookings,
        confirmedBookings,
        completedBookings,
        cancelledBookings,
        monthBookings,
        monthBookingsCap: provider.subscriptionPlan === SubscriptionPlan.FREE ? 30 : (provider.subscriptionPlan === SubscriptionPlan.STARTER ? 150 : 999999),
        grossEarnings: earningsStats._sum.amount || 0,
        netEarnings: earningsStats._sum.providerShare || 0,
        platformCommissionPaid: earningsStats._sum.platformCommission || 0,
      },
      servicesMetrics: servicePopularity,
      staffMetrics: staffPerformance,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to aggregate business statistics' });
  }
}
