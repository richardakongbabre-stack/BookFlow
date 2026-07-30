import { Router } from 'express';
import { authenticateJWT, requireRoles } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { validate } from '../middleware/validation';
import { Role } from '@prisma/client';

import {
  register,
  login,
  getMe,
  registerSchema,
  loginSchema,
} from '../controllers/authController';

import {
  listProviders,
  getProviderBySlug,
  onboardProvider,
  createStaff,
  createService,
  getProviderStaff,
  getProviderServices,
  updateStaffSchedule,
  addStaffException,
  changeSubscription,
  onboardProviderSchema,
  createStaffSchema,
  createServiceSchema,
  updateScheduleSchema,
  addExceptionSchema,
} from '../controllers/providerController';

import {
  getAvailability,
  createBooking,
  getBookings,
  cancelBooking,
  getAvailabilitySchema,
  createBookingSchema,
} from '../controllers/bookingController';

import {
  getPlatformDashboard,
  getProviderDashboard,
} from '../controllers/adminController';

import { initializePayment } from '../controllers/paymentController';

const router = Router();

// ==================== AUTH ROUTES ====================
router.post('/auth/register', validate(registerSchema), register);
router.post('/auth/login', validate(loginSchema), login);
router.get('/auth/me', authenticateJWT, getMe);

// ==================== PROVIDER ROUTES ====================
router.get('/providers', listProviders);
router.post('/providers/onboard', validate(onboardProviderSchema), onboardProvider);
router.get('/providers/profile/:providerSlug', getProviderBySlug);

// Tenant-Isolated Provider Admin / Staff Routes
router.get('/providers/staff', authenticateJWT, requireRoles(Role.PROVIDER_ADMIN, Role.STAFF), getProviderStaff);
router.get('/providers/services', authenticateJWT, requireRoles(Role.PROVIDER_ADMIN, Role.STAFF), getProviderServices);
router.post('/providers/staff/create', authenticateJWT, requireRoles(Role.PROVIDER_ADMIN), validate(createStaffSchema), createStaff);
router.post('/providers/services/create', authenticateJWT, requireRoles(Role.PROVIDER_ADMIN), validate(createServiceSchema), createService);
router.put('/providers/staff/:staffId/schedule', authenticateJWT, requireRoles(Role.PROVIDER_ADMIN), validate(updateScheduleSchema), updateStaffSchedule);
router.post('/providers/staff/:staffId/exception', authenticateJWT, requireRoles(Role.PROVIDER_ADMIN), validate(addExceptionSchema), addStaffException);
router.put('/providers/subscription', authenticateJWT, requireRoles(Role.PROVIDER_ADMIN), changeSubscription);

// ==================== BOOKING ROUTES ====================
router.get('/bookings/availability', validate(getAvailabilitySchema), getAvailability);
router.post('/bookings/create', authenticateJWT, validate(createBookingSchema), createBooking);
router.get('/bookings', authenticateJWT, getBookings);
router.put('/bookings/:bookingId/cancel', authenticateJWT, cancelBooking);

// ==================== PAYMENT ROUTES ====================
router.post('/payments/initialize', authenticateJWT, initializePayment);

// ==================== ANALYTICS / ADMIN ROUTES ====================
router.get('/admin/dashboard', authenticateJWT, requireRoles(Role.PLATFORM_ADMIN), getPlatformDashboard);
router.get('/admin/provider/dashboard', authenticateJWT, requireRoles(Role.PROVIDER_ADMIN, Role.STAFF), getProviderDashboard);

export default router;
