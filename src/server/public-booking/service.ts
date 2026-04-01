import { type VenueBookingMode } from '@prisma/client';
import { prisma } from '@/server/db/prisma/client';
import {
  listAvailableSlots,
  listAvailableTables
} from '@/server/reservations/availability-service';
import { createReservation } from '@/server/reservations/service';
import { ReservationValidationError } from '@/server/reservations/errors';
import {
  publicSlotQuerySchema,
  createPublicBookingSchema,
  type CreatePublicBookingInput
} from './validation';

type PublicVenue = {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  timezone: string;
  publicBookingEnabled: boolean;
  bookingMode: VenueBookingMode;
  maxOnlinePartySize: number;
  minAdvanceNoticeMinutes: number;
  maxDaysAhead: number;
  defaultReservationDurationMinutes: number;
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

type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function getZonedDateTimeParts(
  date: Date,
  timeZone: string
): ZonedDateTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute)
  };
}

function zonedTimeToUtc(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  timeZone: string;
}) {
  let guessUtc = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    0,
    0
  );

  for (let index = 0; index < 3; index += 1) {
    const parts = getZonedDateTimeParts(new Date(guessUtc), input.timeZone);
    const localAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      0,
      0
    );
    const targetAsUtc = Date.UTC(
      input.year,
      input.month - 1,
      input.day,
      input.hour,
      input.minute,
      0,
      0
    );

    guessUtc += targetAsUtc - localAsUtc;
  }

  return new Date(guessUtc);
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
  venue: PublicVenue;
  partySize: number;
  startAt: Date;
  now?: Date;
}) {
  if (input.partySize > input.venue.maxOnlinePartySize) {
    throw new PublicBookingError(
      'PARTY_SIZE_TOO_LARGE',
      `Online booking currently supports up to ${input.venue.maxOnlinePartySize} guests.`
    );
  }

  const now = input.now ?? new Date();
  const minAt = new Date(
    now.getTime() + input.venue.minAdvanceNoticeMinutes * 60_000
  );
  if (input.startAt < minAt) {
    throw new PublicBookingError(
      'TOO_SOON',
      'This time is too soon to book online.'
    );
  }

  const maxAt = new Date(
    now.getTime() + input.venue.maxDaysAhead * 24 * 60 * 60_000
  );
  if (input.startAt > maxAt) {
    throw new PublicBookingError(
      'TOO_FAR',
      `Bookings are only available up to ${input.venue.maxDaysAhead} days ahead.`
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
      maxOnlinePartySize: true,
      minAdvanceNoticeMinutes: true,
      maxDaysAhead: true,
      defaultReservationDurationMinutes: true
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

  if (input.partySize > input.venue.maxOnlinePartySize) {
    throw new PublicBookingError(
      'PARTY_SIZE_TOO_LARGE',
      `Online booking currently supports up to ${input.venue.maxOnlinePartySize} guests.`
    );
  }

  const slots = await listAvailableSlots({
    organizationId: input.venue.organizationId,
    venueId: input.venue.id,
    date: parseVenueCalendarDate(input.dateText, input.venue.timezone),
    partySize: input.partySize,
    durationMinutes: input.venue.defaultReservationDurationMinutes
  });

  const now = new Date();
  const maxAt = new Date(
    now.getTime() + input.venue.maxDaysAhead * 24 * 60 * 60_000
  );
  const minAt = new Date(
    now.getTime() + input.venue.minAdvanceNoticeMinutes * 60_000
  );

  return slots.filter((slot) => slot.startAt >= minAt && slot.startAt <= maxAt);
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

  assertBookingWindow({
    venue: input.venue,
    partySize: parsed.data.partySize,
    startAt: parsed.data.startAt
  });

  const availability = await listAvailableTables({
    organizationId: input.venue.organizationId,
    venueId: input.venue.id,
    startAt: parsed.data.startAt,
    partySize: parsed.data.partySize,
    durationMinutes: input.venue.defaultReservationDurationMinutes
  });

  if (!availability.allowed || availability.recommendedTableIds.length === 0) {
    throw new PublicBookingError(
      'SLOT_UNAVAILABLE',
      'That time just became unavailable. Please select a different slot.',
      409
    );
  }

  const normalizedEmail = normalizeEmail(parsed.data.email);
  const normalizedPhone = normalizePhone(parsed.data.phone);
  const name = splitName(parsed.data.fullName);
  const existingGuest = await findExistingGuest({
    organizationId: input.venue.organizationId,
    email: normalizedEmail,
    phone: normalizedPhone
  });

  const targetCode = resolveTargetStatusCode(input.venue.bookingMode);
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
        reservationDate: parsed.data.startAt,
        startAt: parsed.data.startAt,
        durationMinutes: input.venue.defaultReservationDurationMinutes,
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
        tableIds: availability.recommendedTableIds,
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
