import { PrismaClient, Role, SubscriptionPlan, BookingStatus, PaymentStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // 1. Clear database (order matters due to foreign keys)
  await prisma.auditLog.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.staffSchedule.deleteMany({});
  await prisma.availabilityException.deleteMany({});
  await prisma.staffService.deleteMany({});
  await prisma.service.deleteMany({});
  await prisma.staff.deleteMany({});
  await prisma.provider.deleteMany({});
  await prisma.user.deleteMany({});

  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash('admin123', salt);
  const providerPasswordHash = await bcrypt.hash('provider123', salt);
  const staffPasswordHash = await bcrypt.hash('staff123', salt);
  const customerPasswordHash = await bcrypt.hash('customer123', salt);

  console.log('Creating users and providers...');

  // 2. Create Platform Admin
  const platformAdmin = await prisma.user.create({
    data: {
      email: 'admin@bookflow.com',
      passwordHash: adminPasswordHash,
      name: 'Super Admin',
      role: Role.PLATFORM_ADMIN,
    },
  });
  console.log('Platform Admin created.');

  // 3. Create Provider 1 (Green Garden Salon - PROFESSIONAL Plan)
  const provider1 = await prisma.provider.create({
    data: {
      name: 'Green Garden Salon',
      slug: 'green-garden',
      description: 'Eco-friendly beauty salon offering organic hair care and spa treatments.',
      phone: '+15551002000',
      email: 'contact@greengarden.com',
      address: '123 Mint Avenue, Emerald City',
      subscriptionPlan: SubscriptionPlan.PROFESSIONAL,
      subStatus: 'ACTIVE',
      commissionRate: 0.05, // 5% commission
    },
  });

  const owner1 = await prisma.user.create({
    data: {
      email: 'owner@greengarden.com',
      passwordHash: providerPasswordHash,
      name: 'Elena Green',
      role: Role.PROVIDER_ADMIN,
    },
  });

  const staffElena = await prisma.staff.create({
    data: {
      userId: owner1.id,
      providerId: provider1.id,
      name: 'Elena Green',
      title: 'Salon Director & Lead Stylist',
      bio: 'Elena has 15 years of experience in organic color treatments and custom cuts.',
      rating: 4.9,
    },
  });

  const userStaff1 = await prisma.user.create({
    data: {
      email: 'clara@greengarden.com',
      passwordHash: staffPasswordHash,
      name: 'Clara Oswald',
      role: Role.STAFF,
    },
  });

  const staffClara = await prisma.staff.create({
    data: {
      userId: userStaff1.id,
      providerId: provider1.id,
      name: 'Clara Oswald',
      title: 'Senior Hair Stylist',
      bio: 'Specialist in balayage techniques and modern textured styling.',
      rating: 4.8,
    },
  });

  // Services for Provider 1
  const serviceHaircut = await prisma.service.create({
    data: {
      providerId: provider1.id,
      name: 'Haircut & Blowout',
      description: 'Includes consultation, organic wash, custom haircut, and blowout.',
      duration: 45,
      price: 65.00,
      isFeatured: true,
    },
  });

  const serviceColor = await prisma.service.create({
    data: {
      providerId: provider1.id,
      name: 'Balayage Color',
      description: 'Hand-painted highlights for a natural, sun-kissed look. Does not include toner.',
      duration: 120,
      price: 160.00,
      isFeatured: true,
    },
  });

  const serviceTreatment = await prisma.service.create({
    data: {
      providerId: provider1.id,
      name: 'Deep Conditioning Treatment',
      description: 'Intense hydration using plant-based essential oils to restore shine.',
      duration: 30,
      price: 45.00,
    },
  });

  // Link staff to services
  await prisma.staffService.createMany({
    data: [
      { staffId: staffElena.id, serviceId: serviceHaircut.id },
      { staffId: staffElena.id, serviceId: serviceColor.id },
      { staffId: staffElena.id, serviceId: serviceTreatment.id },
      { staffId: staffClara.id, serviceId: serviceHaircut.id },
      { staffId: staffClara.id, serviceId: serviceColor.id },
    ],
  });

  // Schedules (Monday-Friday, 9:00 - 17:00)
  for (let i = 1; i <= 5; i++) {
    await prisma.staffSchedule.create({
      data: { staffId: staffElena.id, dayOfWeek: i, startTime: '09:00', endTime: '17:00' },
    });
    await prisma.staffSchedule.create({
      data: { staffId: staffClara.id, dayOfWeek: i, startTime: '10:00', endTime: '18:00' },
    });
  }

  // 4. Create Provider 2 (Eco Cuts Barbershop - FREE Plan)
  const provider2 = await prisma.provider.create({
    data: {
      name: 'Eco Cuts Barbershop',
      slug: 'eco-cuts',
      description: 'Fast, classic haircuts with a low carbon footprint.',
      phone: '+15552003000',
      email: 'info@ecocuts.com',
      address: '77 Forest Street, Oakwood',
      subscriptionPlan: SubscriptionPlan.FREE,
      subStatus: 'ACTIVE',
      commissionRate: 0.0, // Free tier commission
    },
  });

  const owner2 = await prisma.user.create({
    data: {
      email: 'owner@ecocuts.com',
      passwordHash: providerPasswordHash,
      name: 'Marcus Stone',
      role: Role.PROVIDER_ADMIN,
    },
  });

  const staffMarcus = await prisma.staff.create({
    data: {
      userId: owner2.id,
      providerId: provider2.id,
      name: 'Marcus Stone',
      title: 'Master Barber',
      bio: 'Eco-conscious barber passionate about classic razor work.',
      rating: 4.7,
    },
  });

  const serviceBuzz = await prisma.service.create({
    data: {
      providerId: provider2.id,
      name: 'Classic Buzzcut',
      description: 'Single-guard clipper cut all over, finished with a warm lather neck shave.',
      duration: 20,
      price: 25.00,
      isFeatured: true,
    },
  });

  const serviceBeard = await prisma.service.create({
    data: {
      providerId: provider2.id,
      name: 'Beard Grooming',
      description: 'Trimming, shaping, and conditioning with natural beard oil.',
      duration: 15,
      price: 15.00,
    },
  });

  const serviceShave = await prisma.service.create({
    data: {
      providerId: provider2.id,
      name: 'Hot Towel Shave',
      description: 'Traditional straight razor shave with essential oils and hot towels.',
      duration: 30,
      price: 35.00,
    },
  });

  // Link staff to services
  await prisma.staffService.createMany({
    data: [
      { staffId: staffMarcus.id, serviceId: serviceBuzz.id },
      { staffId: staffMarcus.id, serviceId: serviceBeard.id },
      { staffId: staffMarcus.id, serviceId: serviceShave.id },
    ],
  });

  // Schedule for Marcus (Tuesday-Saturday, 8:00 - 16:00)
  for (let i = 2; i <= 6; i++) {
    await prisma.staffSchedule.create({
      data: { staffId: staffMarcus.id, dayOfWeek: i, startTime: '08:00', endTime: '16:00' },
    });
  }

  // 5. Create Provider 3 (Elite Wellness Spa - ENTERPRISE Plan)
  const provider3 = await prisma.provider.create({
    data: {
      name: 'Elite Wellness Spa',
      slug: 'elite-wellness',
      description: 'Luxury wellness experience providing massage therapy and premium skincare.',
      phone: '+15553004000',
      email: 'spa@elitewellness.com',
      address: '999 Platinum Plaza, Cloud Valley',
      subscriptionPlan: SubscriptionPlan.ENTERPRISE,
      subStatus: 'ACTIVE',
      commissionRate: 0.03, // 3% commission
    },
  });

  const owner3 = await prisma.user.create({
    data: {
      email: 'owner@elitewellness.com',
      passwordHash: providerPasswordHash,
      name: 'Sofia Martinez',
      role: Role.PROVIDER_ADMIN,
    },
  });

  const staffSofia = await prisma.staff.create({
    data: {
      userId: owner3.id,
      providerId: provider3.id,
      name: 'Sofia Martinez',
      title: 'Spa Manager & Aesthetician',
      bio: 'Dedicated therapist with certifications in medical aesthetics.',
      rating: 5.0,
    },
  });

  const serviceMassage = await prisma.service.create({
    data: {
      providerId: provider3.id,
      name: 'Full Body Massage',
      description: 'Swedish style therapeutic massage with customized pressure.',
      duration: 60,
      price: 110.00,
      isFeatured: true,
    },
  });

  await prisma.staffService.create({
    data: { staffId: staffSofia.id, serviceId: serviceMassage.id },
  });

  for (let i = 1; i <= 5; i++) {
    await prisma.staffSchedule.create({
      data: { staffId: staffSofia.id, dayOfWeek: i, startTime: '09:00', endTime: '17:00' },
    });
  }

  // 6. Create Customer
  const customer = await prisma.user.create({
    data: {
      email: 'customer@gmail.com',
      passwordHash: customerPasswordHash,
      name: 'John Doe',
      phone: '+15559876543',
      role: Role.CUSTOMER,
    },
  });
  console.log('Sample Customer created.');

  // 7. Create some past & future bookings for Green Garden
  console.log('Seeding sample bookings...');
  
  // A completed booking in the past
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 2);
  pastDate.setHours(10, 0, 0, 0); // 10:00 AM

  const pastEndDate = new Date(pastDate);
  pastEndDate.setMinutes(pastEndDate.getMinutes() + serviceHaircut.duration);

  const pastBooking = await prisma.booking.create({
    data: {
      providerId: provider1.id,
      customerId: customer.id,
      staffId: staffElena.id,
      serviceId: serviceHaircut.id,
      startTime: pastDate,
      endTime: pastEndDate,
      status: BookingStatus.COMPLETED,
      totalAmount: serviceHaircut.price,
      commissionAmount: Number(serviceHaircut.price) * Number(provider1.commissionRate),
      notes: 'Prefers mild lavender scent shampoos.',
    },
  });

  await prisma.payment.create({
    data: {
      bookingId: pastBooking.id,
      providerId: provider1.id,
      amount: serviceHaircut.price,
      providerShare: Number(serviceHaircut.price) * (1 - Number(provider1.commissionRate)),
      platformCommission: Number(serviceHaircut.price) * Number(provider1.commissionRate),
      status: PaymentStatus.SUCCESSFUL,
      transactionId: 'ch_mock_12345',
      gateway: 'STRIPE',
      createdAt: pastDate,
    },
  });

  // A confirmed booking in the future
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 1);
  futureDate.setHours(14, 0, 0, 0); // 2:00 PM tomorrow

  const futureEndDate = new Date(futureDate);
  futureEndDate.setMinutes(futureEndDate.getMinutes() + serviceColor.duration);

  const futureBooking = await prisma.booking.create({
    data: {
      providerId: provider1.id,
      customerId: customer.id,
      staffId: staffClara.id,
      serviceId: serviceColor.id,
      startTime: futureDate,
      endTime: futureEndDate,
      status: BookingStatus.CONFIRMED,
      totalAmount: serviceColor.price,
      commissionAmount: Number(serviceColor.price) * Number(provider1.commissionRate),
    },
  });

  await prisma.payment.create({
    data: {
      bookingId: futureBooking.id,
      providerId: provider1.id,
      amount: serviceColor.price,
      providerShare: Number(serviceColor.price) * (1 - Number(provider1.commissionRate)),
      platformCommission: Number(serviceColor.price) * Number(provider1.commissionRate),
      status: PaymentStatus.SUCCESSFUL,
      transactionId: 'ch_mock_67890',
      gateway: 'STRIPE',
      createdAt: new Date(),
    },
  });

  console.log('Database seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
