import { PrismaClient, BookingStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface TimeSlot {
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  dateTimeISO: string; // Full ISO string for checkout
}

/**
 * Calculates available timeslots for a staff member on a specific date for a given service.
 * @param providerId The provider's UUID
 * @param staffId The staff member's UUID
 * @param serviceId The service's UUID
 * @param dateStr ISO date string (YYYY-MM-DD)
 */
export async function getAvailableSlots(
  providerId: string,
  staffId: string,
  serviceId: string,
  dateStr: string
): Promise<TimeSlot[]> {
  // 1. Fetch the service to check its duration
  const service = await prisma.service.findFirst({
    where: { id: serviceId, providerId },
  });
  if (!service) {
    throw new Error('Service not found or does not belong to this provider');
  }
  const duration = service.duration; // in minutes

  // 2. Verify that staff is assigned to this service
  const staffService = await prisma.staffService.findUnique({
    where: {
      staffId_serviceId: { staffId, serviceId },
    },
  });
  if (!staffService) {
    return []; // Staff cannot perform this service
  }

  // Parse the input date
  const targetDate = new Date(dateStr);
  if (isNaN(targetDate.getTime())) {
    throw new Error('Invalid date string format. Use YYYY-MM-DD.');
  }

  const dayOfWeek = targetDate.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.

  // 3. Look up standard working hours for that day of the week
  const standardSchedule = await prisma.staffSchedule.findFirst({
    where: { staffId, dayOfWeek },
  });

  // 4. Look up availability exceptions for that specific date
  const startOfDay = new Date(targetDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const exception = await prisma.availabilityException.findFirst({
    where: {
      staffId,
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  let workingHours = { start: '', end: '', isWorking: false };

  if (exception) {
    if (exception.isWorking && exception.startTime && exception.endTime) {
      workingHours = {
        start: exception.startTime,
        end: exception.endTime,
        isWorking: true,
      };
    } else {
      // Excluded / Off day exception
      workingHours = { start: '', end: '', isWorking: false };
    }
  } else if (standardSchedule) {
    workingHours = {
      start: standardSchedule.startTime,
      end: standardSchedule.endTime,
      isWorking: true,
    };
  }

  if (!workingHours.isWorking) {
    return []; // No working hours scheduled or time-off exception exists
  }

  // Helper to convert "HH:MM" string to minutes from midnight
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const startMinutes = timeToMinutes(workingHours.start);
  const endMinutes = timeToMinutes(workingHours.end);

  // 5. Retrieve existing confirmed/pending bookings on this date for this staff
  const existingBookings = await prisma.booking.findMany({
    where: {
      staffId,
      status: {
        in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      },
      startTime: {
        gte: startOfDay,
      },
      endTime: {
        lte: endOfDay,
      },
    },
    select: {
      startTime: true,
      endTime: true,
    },
  });

  // Map existing bookings to minute ranges relative to startOfDay
  const busyRanges = existingBookings.map((b) => {
    const bStart = new Date(b.startTime);
    const bEnd = new Date(b.endTime);
    
    const startMin = bStart.getUTCHours() * 60 + bStart.getUTCMinutes();
    const endMin = bEnd.getUTCHours() * 60 + bEnd.getUTCMinutes();
    
    return { start: startMin, end: endMin };
  });

  // 6. Generate slots
  // We allow slots to start every 30 minutes (slot step/interval)
  const slotStep = 30;
  const availableSlots: TimeSlot[] = [];

  for (let current = startMinutes; current + duration <= endMinutes; current += slotStep) {
    const slotStart = current;
    const slotEnd = current + duration;

    // Check for overlap with any busy range
    const isOverlapping = busyRanges.some((busy) => {
      // Standard overlap check: Start1 < End2 AND End1 > Start2
      return slotStart < busy.end && slotEnd > busy.start;
    });

    if (!isOverlapping) {
      const formatTime = (totalMinutes: number): string => {
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      };

      // Construct full ISO datetime strings in UTC
      const slotStartISO = new Date(targetDate);
      slotStartISO.setUTCHours(Math.floor(slotStart / 60), slotStart % 60, 0, 0);

      availableSlots.push({
        startTime: formatTime(slotStart),
        endTime: formatTime(slotEnd),
        dateTimeISO: slotStartISO.toISOString(),
      });
    }
  }

  return availableSlots;
}
