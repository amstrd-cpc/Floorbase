import { type VenueBookingMode, type VenuePlacementMode } from '@prisma/client';
import { prisma } from '@/server/db/prisma/client';
import {
  listAvailableSlots,
  listAvailableTables
} from '@/server/reservations/availability-service';
import { createReservation } from '@/server/reservations/service';
import { ReservationValidationError } from '@/server/reservations/errors';
import {
  formatDateTimeForTimeZone,
  zonedTimeToUtc
} from '@/lib/timezone';
import {
  publicSlotQuerySchema,
  createPublicBookingSchema,
  type CreatePublicBookingInput
} from './validation';
import {
  resolveBookingConfig,
  type PublicVenueWithEvents
} from './config-resolver';

type PublicVenue = {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  timezone: string;
  publicBookingEnabled: boolean;
  bookingMode: VenueBookingMode;
  placementMode: VenuePlacementMode;
  minPartySize: number;
  maxOnlinePartySize: number;
  minAdvanceNoticeMinutes: number;
  maxDaysAhead: number;
  defaultReservationDurationMinutes: number;
  publicInstructions: string | null;
  bookingEvents: PublicVenueWithEvents['bookingEvents'];
};

type PublicErrorCode =
  | 'VENUE_NOT_AVAILABLE'
  | 'INVALID_INPUT'
  | 'PARTY_SIZE_TOO_LARGE'
  | 'TOO_SOON'
  | 'TOO_FAR'
  | 'SLOT_UNAVAILABLE'
  | 'UNKNOWN';

export class PublicBookingError extends Error {
  constructor(
    readonly code: PublicErrorCode,
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = 'PublicBookingError';
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string) {
  return phone.replace(/\s+/g, ' ').trim();
}

function splitName(fullName: string) {
  const normalized = fullName.trim().replace(/\s+/g, ' ');
  const [firstName, ...rest] = normalized.split(' ');
  return {
    firstName: firstName ?? null,
    lastName: rest.join(' ') || null,
    fullName: normalized
  };
}

function resolveTargetStatusCode(mode: VenueBookingMode) {
  return mode === 'REQUEST_ONLY' ? 'PENDING' : 'CONFIRMED';
}

function parseVenueCalendarDate(dateText: string, timeZone: string) {
  const [yearText, monthText, dayText] = dateText.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new PublicBookingError(
      'INVALID_INPUT',
      'Please provide a valid date.'
    );
  }

  return zonedTimeToUtc({
    year,
    month,
    day,
    hour: 12,
    minute: 0,
    timeZone
  });
}

function assertBookingWindow(input: {
  config: ReturnType<typeof resolveBookingConfig>['config'];
  partySize: number;
  startAt: Date;
  now?: Date;
}) {
  if (input.partySize < input.config.minPartySize) {
    throw new PublicBookingError(
      'INVALID_INPUT',
      `Party size must be at least ${input.config.minPartySize}.`
    );
  }
  if (input.partySize > input.config.maxOnlinePartySize) {
    throw new PublicBookingError(
      'PARTY_SIZE_TOO_LARGE',
      `Online booking currently supports up to ${input.config.maxOnlinePartySize} guests.`
    );
  }

  const now = input.now ?? new Date();
  const minAt = new Date(
    now.getTime() + input.config.minAdvanceNoticeMinutes * 60_000
  );
  if (input.startAt < minAt) {
    throw new PublicBookingError(
      'TOO_SOON',
      'This time is too soon to book online.'
    );
  }

  const maxAt = new Date(
    now.getTime() + input.config.maxDaysAhead * 24 * 60 * 60_000
  );
  if (input.startAt > maxAt) {
    throw new PublicBookingError(
      'TOO_FAR',
      `Bookings are only available up to ${input.config.maxDaysAhead} days ahead.`
    );
  }
}

export async function getPublicVenueBySlug(
  venueSlug: string
): Promise<PublicVenue> {
  const venue = await prisma.venue.findFirst({
    where: { slug: venueSlug, isActive: true },
    select: {
      id: true,
      organizationId: true,
      slug: true,
      name: true,
      timezone: true,
      publicBookingEnabled: true,
      bookingMode: true,
      placementMode: true,
      minPartySize: true,
      maxOnlinePartySize: true,
      minAdvanceNoticeMinutes: true,
      maxDaysAhead: true,
      defaultReservationDurationMinutes: true,
      publicInstructions: true,
      bookingEvents: true
    }
  });

  if (!venue || !venue.publicBookingEnabled) {
    throw new PublicBookingError(
      'VENUE_NOT_AVAILABLE',
      'This venue is not accepting online bookings right now.',
      404
    );
  }

  return venue;
}

export async function getPublicSlots(input: {
  venue: PublicVenue;
  dateText: string;
  partySize: number;
}) {
  const parsed = publicSlotQuerySchema.safeParse({
    date: input.dateText,
    partySize: input.partySize
  });
  if (!parsed.success) {
    throw new PublicBookingError(
      'INVALID_INPUT',
      'Please provide a valid date and party size.'
    );
  }

  const resolved = resolveBookingConfig({
    venue: input.venue,
    bookingDate: parseVenueCalendarDate(input.dateText, input.venue.timezone)
  });
  if (input.partySize < resolved.config.minPartySize) {
    throw new PublicBookingError(
      'INVALID_INPUT',
      `Party size must be at least ${resolved.config.minPartySize}.`
    );
  }
  if (input.partySize > resolved.config.maxOnlinePartySize) {
    throw new PublicBookingError(
      'PARTY_SIZE_TOO_LARGE',
      `Online booking currently supports up to ${resolved.config.maxOnlinePartySize} guests.`
    );
  }

  const slots = await listAvailableSlots({
    organizationId: input.venue.organizationId,
    venueId: input.venue.id,
    date: parseVenueCalendarDate(input.dateText, input.venue.timezone),
    partySize: input.partySize,
    durationMinutes: resolved.config.durationMinutes,
    allowedAreaIds: resolved.config.allowedAreaIds,
    allowedTableIds: resolved.config.allowedTableIds
  });

  const now = new Date();
  const maxAt = new Date(
    now.getTime() + resolved.config.maxDaysAhead * 24 * 60 * 60_000
  );
  const minAt = new Date(
    now.getTime() + resolved.config.minAdvanceNoticeMinutes * 60_000
  );

  return {
    resolvedConfig: resolved.config,
    slots: slots
      .filter((slot) => slot.startAt >= minAt && slot.startAt <= maxAt)
      .map((slot) => ({
        ...slot,
        availableTables:
          resolved.config.placementMode === 'TABLE_SELECTION'
            ? slot.availableTables.filter(
                (table) => table.capacityMax >= input.partySize
              )
            : slot.availableTables,
        localStartAt: formatDateTimeForTimeZone(slot.startAt, input.venue.timezone)
      }))
      .filter(
        (slot) =>
          resolved.config.placementMode !== 'TABLE_SELECTION' ||
          slot.availableTables.length > 0
      )
  };
}

async function resolveSystemActorUserId(organizationId: string) {
  const user = await prisma.user.findFirst({
    where: { organizationId, isActive: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' }
  });

  if (!user) {
    throw new PublicBookingError(
      'UNKNOWN',
      'Booking is temporarily unavailable.',
      503
    );
  }

  return user.id;
}

async function findExistingGuest(input: {
  organizationId: string;
  email: string;
  phone: string;
}) {
  return prisma.guest.findFirst({
    where: {
      organizationId: input.organizationId,
      OR: [{ email: input.email }, { phone: input.phone }]
    },
    select: { id: true }
  });
}

export async function createPublicBooking(input: {
  venue: PublicVenue;
  payload: CreatePublicBookingInput;
}) {
  const parsed = createPublicBookingSchema.safeParse(input.payload);
  if (!parsed.success) {
    throw new PublicBookingError(
      'INVALID_INPUT',
      'Please complete all required fields with valid values.'
    );
  }

  const startAtUtc = new Date(parsed.data.slotId);

  if (Number.isNaN(startAtUtc.getTime())) {
    throw new PublicBookingError('INVALID_INPUT', 'Please select a valid time slot.');
  }

  const resolved = resolveBookingConfig({
    venue: input.venue,
    bookingDate: startAtUtc
  });

  assertBookingWindow({
    config: resolved.config,
    partySize: parsed.data.partySize,
    startAt: startAtUtc
  });

  const availability = await listAvailableTables({
    organizationId: input.venue.organizationId,
    venueId: input.venue.id,
    startAt: startAtUtc,
    partySize: parsed.data.partySize,
    durationMinutes: resolved.config.durationMinutes,
    allowedAreaIds: resolved.config.allowedAreaIds,
    allowedTableIds: resolved.config.allowedTableIds
  });

  if (!availability.allowed || availability.recommendedTableIds.length === 0) {
    throw new PublicBookingError(
      'SLOT_UNAVAILABLE',
      'That time just became unavailable. Please select a different slot.',
      409
    );
  }

  const requestedTableId = parsed.data.selectedTableId?.trim();
  if (
    resolved.config.placementMode === 'TABLE_SELECTION' &&
    !requestedTableId
  ) {
    throw new PublicBookingError(
      'INVALID_INPUT',
      'Please select a table for this booking.'
    );
  }

  let tableIds = availability.recommendedTableIds;
  if (resolved.config.placementMode === 'TABLE_SELECTION' && requestedTableId) {
    const selectedTable = availability.availableTables.find(
      (table) => table.id === requestedTableId
    );
    if (!selectedTable || parsed.data.partySize > selectedTable.capacityMax) {
      throw new PublicBookingError(
        'SLOT_UNAVAILABLE',
        'The selected table is not available for this party size.',
        409
      );
    }
    tableIds = [selectedTable.id];
  }

  const normalizedEmail = normalizeEmail(parsed.data.email);
  const normalizedPhone = normalizePhone(parsed.data.phone);
  const name = splitName(parsed.data.fullName);
  const existingGuest = await findExistingGuest({
    organizationId: input.venue.organizationId,
    email: normalizedEmail,
    phone: normalizedPhone
  });

  const targetCode = resolveTargetStatusCode(resolved.config.confirmationMode);
  const status = await prisma.reservationStatus.findFirst({
    where: {
      organizationId: input.venue.organizationId,
      code: targetCode,
      isActive: true
    },
    select: { id: true, code: true }
  });

  if (!status) {
    throw new PublicBookingError(
      'UNKNOWN',
      'Booking is temporarily unavailable.',
      503
    );
  }

  const actorUserId = await resolveSystemActorUserId(
    input.venue.organizationId
  );

  try {
    const reservation = await createReservation({
      organizationId: input.venue.organizationId,
      payload: {
        venueId: input.venue.id,
        reservationDate: startAtUtc,
        startAt: startAtUtc,
        durationMinutes: resolved.config.durationMinutes,
        partySize: parsed.data.partySize,
        existingGuestId: existingGuest?.id,
        guest: {
          fullName: name.fullName,
          firstName: name.firstName,
          lastName: name.lastName,
          email: normalizedEmail,
          phone: normalizedPhone
        },
        reservationStatusId: status.id,
        tableIds,
        specialRequests: parsed.data.note,
        source: 'PUBLIC_ONLINE',
        depositRequired: false
      },
      context: { actorUserId }
    });

    return {
      reservationId: reservation.id,
      statusCode: status.code
    };
  } catch (error) {
    if (error instanceof ReservationValidationError) {
      throw new PublicBookingError(
        'SLOT_UNAVAILABLE',
        'That time just became unavailable. Please select a different slot.',
        409
      );
    }

    throw error;
  }
}
