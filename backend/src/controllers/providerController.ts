import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { PrismaClient, Role, SubscriptionPlan } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';

const prisma = new PrismaClient();

// Validation Schemas
export const onboardProviderSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Business name must be at least 2 characters'),
    slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric and dashes only'),
    description: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email('Invalid business email'),
    address: z.string().optional(),
    subscriptionPlan: z.nativeEnum(SubscriptionPlan).optional().default(SubscriptionPlan.FREE),
    
    ownerName: z.string().min(2, 'Owner name must be at least 2 characters'),
    ownerEmail: z.string().email('Invalid owner email'),
    ownerPassword: z.string().min(6, 'Owner password must be at least 6 characters'),
  }),
});

export const createStaffSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Staff name must be at least 2 characters'),
    title: z.string().optional(),
    bio: z.string().optional(),
    email: z.string().email('Invalid staff email address'),
    password: z.string().min(6, 'Staff password must be at least 6 characters'),
  }),
});

export const createServiceSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Service name must be at least 2 characters'),
    description: z.string().optional(),
    duration: z.number().int().min(5, 'Duration must be at least 5 minutes'),
    price: z.number().positive('Price must be positive'),
    isFeatured: z.boolean().optional().default(false),
  }),
});

export const updateScheduleSchema = z.object({
  body: z.object({
    schedules: z.array(z.object({
      dayOfWeek: z.number().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM'),
      endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM'),
    })),
  }),
});

export const addExceptionSchema = z.object({
  body: z.object({
    date: z.string(), // YYYY-MM-DD
    isWorking: z.boolean(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM').optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM').optional(),
  }),
});

/**
 * Public: Lists all active businesses/providers.
 */
export async function listProviders(req: AuthenticatedRequest, res: Response) {
  try {
    const providers = await prisma.provider.findMany({
      where: { subStatus: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        phone: true,
        email: true,
        address: true,
        subscriptionPlan: true,
      },
    });
    return res.json(providers);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve providers' });
  }
}

/**
 * Public: Retrieve complete provider details (including services and staff profiles).
 */
export async function getProviderBySlug(req: AuthenticatedRequest, res: Response) {
  const { providerSlug } = req.params;

  try {
    const provider = await prisma.provider.findUnique({
      where: { slug: providerSlug },
      include: {
        services: true,
        staff: {
          select: {
            id: true,
            name: true,
            title: true,
            bio: true,
            rating: true,
            services: {
              select: {
                serviceId: true,
              },
            },
          },
        },
      },
    });

    if (!provider) {
      return res.status(404).json({ error: 'Business provider not found' });
    }

    return res.json(provider);
  } catch (err) {
    return res.status(500).json({ error: 'Server error retrieving provider details' });
  }
}

/**
 * Onboard a new business provider.
 * Automatically provisions: Provider, User (PROVIDER_ADMIN), Staff, and weekly schedule template.
 */
export async function onboardProvider(req: AuthenticatedRequest, res: Response) {
  const {
    name, slug, description, phone, email, address, subscriptionPlan,
    ownerName, ownerEmail, ownerPassword
  } = req.body;

  try {
    // 1. Validate slug and owner uniqueness
    const existingSlug = await prisma.provider.findUnique({ where: { slug } });
    if (existingSlug) {
      return res.status(400).json({ error: 'This business slug (URL path) is already taken' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: ownerEmail } });
    if (existingUser) {
      return res.status(400).json({ error: 'Owner email address is already in use' });
    }

    // Hash owner password
    const salt = await bcrypt.genSalt(10);
    const ownerPasswordHash = await bcrypt.hash(ownerPassword, salt);

    // 2. Set commission based on plan
    let commissionRate = 0.05;
    if (subscriptionPlan === SubscriptionPlan.FREE) commissionRate = 0.0;
    else if (subscriptionPlan === SubscriptionPlan.ENTERPRISE) commissionRate = 0.03;

    // 3. Create all in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create Provider
      const provider = await tx.provider.create({
        data: {
          name,
          slug,
          description,
          phone,
          email,
          address,
          subscriptionPlan,
          commissionRate,
        },
      });

      // Create Admin User
      const user = await tx.user.create({
        data: {
          email: ownerEmail,
          passwordHash: ownerPasswordHash,
          name: ownerName,
          role: Role.PROVIDER_ADMIN,
        },
      });

      // Create Staff record for the Owner
      const staff = await tx.staff.create({
        data: {
          userId: user.id,
          providerId: provider.id,
          name: ownerName,
          title: 'Business Owner',
          bio: 'Founder and administrator.',
        },
      });

      // Seed standard Mon-Fri schedule template
      for (let day = 1; day <= 5; day++) {
        await tx.staffSchedule.create({
          data: {
            staffId: staff.id,
            dayOfWeek: day,
            startTime: '09:00',
            endTime: '17:00',
          },
        });
      }

      return { provider, user };
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        userId: result.user.id,
        action: 'PROVIDER_ONBOARDED',
        details: `Created provider ${name} (${slug}) under subscription plan ${subscriptionPlan}`,
      },
    });

    return res.status(201).json({
      message: 'Onboarding completed successfully',
      provider: result.provider,
      owner: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error during provider onboarding' });
  }
}

/**
 * Staff Creation Endpoint.
 * Enforces tier restrictions based on active subscriptions.
 */
export async function createStaff(req: AuthenticatedRequest, res: Response) {
  const { name, title, bio, email, password } = req.body;
  const providerId = req.tenantId;

  if (!providerId) {
    return res.status(403).json({ error: 'Tenant context missing' });
  }

  try {
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    // 1. Subscription limits check
    const currentStaffCount = await prisma.staff.count({
      where: { providerId },
    });

    let staffCap = 999;
    if (provider.subscriptionPlan === SubscriptionPlan.FREE) staffCap = 1;
    else if (provider.subscriptionPlan === SubscriptionPlan.STARTER) staffCap = 3;
    else if (provider.subscriptionPlan === SubscriptionPlan.PROFESSIONAL) staffCap = 10;

    if (currentStaffCount >= staffCap) {
      return res.status(403).json({
        error: `Staff cap reached. Your current plan (${provider.subscriptionPlan}) limits you to ${staffCap} staff member(s). Please upgrade to add more.`,
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'A user with this email address already exists' });
    }

    // Create staff account
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: Role.STAFF,
        },
      });

      const staff = await tx.staff.create({
        data: {
          userId: user.id,
          providerId,
          name,
          title,
          bio,
        },
      });

      // Default Mon-Fri schedule
      for (let day = 1; day <= 5; day++) {
        await tx.staffSchedule.create({
          data: {
            staffId: staff.id,
            dayOfWeek: day,
            startTime: '09:00',
            endTime: '17:00',
          },
        });
      }

      return staff;
    });

    return res.status(201).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create staff member' });
  }
}

/**
 * Service Creation Endpoint.
 * Enforces tier restrictions based on active subscriptions.
 */
export async function createService(req: AuthenticatedRequest, res: Response) {
  const { name, description, duration, price, isFeatured } = req.body;
  const providerId = req.tenantId;

  if (!providerId) {
    return res.status(403).json({ error: 'Tenant context missing' });
  }

  try {
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    // 1. Subscription limits check
    const currentServicesCount = await prisma.service.count({
      where: { providerId },
    });

    let serviceCap = 999;
    if (provider.subscriptionPlan === SubscriptionPlan.FREE) serviceCap = 3;
    else if (provider.subscriptionPlan === SubscriptionPlan.STARTER) serviceCap = 5;

    if (currentServicesCount >= serviceCap) {
      return res.status(403).json({
        error: `Service cap reached. Your current plan (${provider.subscriptionPlan}) limits you to ${serviceCap} services. Please upgrade to add more.`,
      });
    }

    const service = await prisma.service.create({
      data: {
        providerId,
        name,
        description,
        duration,
        price,
        isFeatured,
      },
    });

    // Automatically link all existing staff to perform this service by default
    const staffMembers = await prisma.staff.findMany({ where: { providerId } });
    if (staffMembers.length > 0) {
      await prisma.staffService.createMany({
        data: staffMembers.map((s) => ({
          staffId: s.id,
          serviceId: service.id,
        })),
      });
    }

    return res.status(201).json(service);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create service' });
  }
}

/**
 * Provider Admin: List all staff for their business.
 */
export async function getProviderStaff(req: AuthenticatedRequest, res: Response) {
  const providerId = req.tenantId;
  if (!providerId) return res.status(403).json({ error: 'Tenant context missing' });

  try {
    const staff = await prisma.staff.findMany({
      where: { providerId },
      include: {
        user: { select: { email: true } },
        schedules: true,
      },
    });
    return res.json(staff);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch staff list' });
  }
}

/**
 * Provider Admin: List all services for their business.
 */
export async function getProviderServices(req: AuthenticatedRequest, res: Response) {
  const providerId = req.tenantId;
  if (!providerId) return res.status(403).json({ error: 'Tenant context missing' });

  try {
    const services = await prisma.service.findMany({
      where: { providerId },
    });
    return res.json(services);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch service list' });
  }
}

/**
 * Update staff availability schedules.
 */
export async function updateStaffSchedule(req: AuthenticatedRequest, res: Response) {
  const { staffId } = req.params;
  const { schedules } = req.body; // Array of dayOfWeek, startTime, endTime
  const providerId = req.tenantId;

  try {
    // Verify staff belongs to this provider
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, providerId },
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found under your business' });
    }

    await prisma.$transaction(async (tx) => {
      // Clear old schedules
      await tx.staffSchedule.deleteMany({ where: { staffId } });

      // Insert new schedules
      await tx.staffSchedule.createMany({
        data: schedules.map((sched: any) => ({
          staffId,
          dayOfWeek: sched.dayOfWeek,
          startTime: sched.startTime,
          endTime: sched.endTime,
        })),
      });
    });

    return res.json({ message: 'Schedules updated successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update schedule' });
  }
}

/**
 * Add availability exceptions (time-off or overtime).
 */
export async function addStaffException(req: AuthenticatedRequest, res: Response) {
  const { staffId } = req.params;
  const { date, isWorking, startTime, endTime } = req.body;
  const providerId = req.tenantId;

  try {
    // Verify staff belongs to this provider
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, providerId },
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found under your business' });
    }

    const exceptionDate = new Date(date);
    if (isNaN(exceptionDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const exception = await prisma.availabilityException.create({
      data: {
        staffId,
        date: exceptionDate,
        isWorking,
        startTime: isWorking ? startTime : null,
        endTime: isWorking ? endTime : null,
      },
    });

    return res.status(201).json(exception);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create availability exception' });
  }
}

/**
 * Provider Admin: Upgrade/downgrade subscription plan.
 */
export async function changeSubscription(req: AuthenticatedRequest, res: Response) {
  const { plan } = req.body; // FREE, STARTER, PROFESSIONAL, ENTERPRISE
  const providerId = req.tenantId;

  if (!providerId) {
    return res.status(403).json({ error: 'Tenant context missing' });
  }

  if (!Object.values(SubscriptionPlan).includes(plan)) {
    return res.status(400).json({ error: 'Invalid subscription plan selection' });
  }

  try {
    // Set commission rate depending on new plan
    let commissionRate = 0.05;
    if (plan === SubscriptionPlan.FREE) commissionRate = 0.0;
    else if (plan === SubscriptionPlan.ENTERPRISE) commissionRate = 0.03;

    const provider = await prisma.provider.update({
      where: { id: providerId },
      data: {
        subscriptionPlan: plan,
        commissionRate,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'PROVIDER_SUBSCRIPTION_CHANGED',
        details: `Changed plan to ${plan}`,
      },
    });

    return res.json({
      message: 'Plan successfully updated',
      provider,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update subscription' });
  }
}
