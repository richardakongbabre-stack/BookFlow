import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from './auth';

const prisma = new PrismaClient();

/**
 * Middleware to resolve the tenant context for public portals (e.g., customers loading a business page).
 * Looks up the provider by slug in parameters or HTTP headers and attaches the provider ID to req.tenantId.
 */
export async function resolveTenant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let providerSlug = req.params.providerSlug || req.query.providerSlug as string || req.headers['x-provider-slug'] as string;

  if (!providerSlug && req.params.bookingId) {
    // Attempt to resolve provider context via booking
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.bookingId },
      select: { providerId: true }
    });
    if (booking) {
      req.tenantId = booking.providerId;
      return next();
    }
  }

  if (!providerSlug) {
    return res.status(400).json({ error: 'Tenant context (provider slug or ID) is required' });
  }

  try {
    const provider = await prisma.provider.findUnique({
      where: { slug: providerSlug },
      select: { id: true }
    });

    if (!provider) {
      return res.status(404).json({ error: 'Business provider not found' });
    }

    req.tenantId = provider.id;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Error resolving tenant context' });
  }
}

/**
 * Middleware to enforce tenant boundary checks for staff and admins.
 * Verifies that a logged-in user is not trying to access or manipulate another tenant's resources.
 */
export function enforceTenantAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // PLATFORM_ADMIN has global privileges and bypasses tenant check
  if (req.user?.role === 'PLATFORM_ADMIN') {
    return next();
  }

  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Ensure the tenant ID resolved from user's staff profile matches the request context
  const requestedTenantId = req.params.providerId || req.body.providerId || req.query.providerId;

  if (requestedTenantId && req.tenantId !== requestedTenantId) {
    return res.status(403).json({ error: 'Access Denied: You do not have permissions to access this tenant data' });
  }

  next();
}
