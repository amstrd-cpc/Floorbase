import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/server/rate-limit';
import {
  createPublicBooking,
  getPublicVenueBySlug,
  PublicBookingError
} from '@/server/public-booking/service';
import { createPublicBookingSchema } from '@/server/public-booking/validation';
import { mapZodErrors } from '@/lib/zod-utils';
import {
  sendGuestConfirmation,
  sendVenueNewReservationAlert
} from '@/server/email/service';
import { prisma } from '@/server/db/prisma/client';
import { env } from '@/env';

function toErrorResponse(error: unknown) {
  if (error instanceof PublicBookingError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }

  console.error('Public booking reserve error', error);
  return NextResponse.json(
    { error: 'We could not submit your booking right now.' },
    { status: 500 }
  );
}

export async function POST(
  request: Request,
  { params }: { params: { venueSlug: string } }
) {
  const ip =
    (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    'unknown';
  const rate = await checkRateLimit({
    key: `reserve:${params.venueSlug}:${ip}`,
    limit: 10,
    windowMs: 60_000
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again shortly.' },
      { status: 429 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 }
    );
  }

  const parsed = createPublicBookingSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Please complete all required fields with valid values.',
        details: mapZodErrors(parsed.error.issues)
      },
      { status: 400 }
    );
  }

  try {
    const venue = await getPublicVenueBySlug(params.venueSlug);
    const result = await createPublicBooking({ venue, payload: parsed.data });

    const modeMessage =
      result.statusCode === 'CONFIRMED'
        ? 'Your reservation is confirmed.'
        : 'Your booking request was received and is pending review.';

    // Send emails in background — never fail the request on email error.
    void sendEmailsForPublicBooking({
      reservationId: result.reservationId,
      statusCode: result.statusCode,
      venue
    });

    return NextResponse.json(
      {
        reservationId: result.reservationId,
        statusCode: result.statusCode,
        message: modeMessage
      },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function sendEmailsForPublicBooking(input: {
  reservationId: string;
  statusCode: string;
  venue: { id: string; organizationId: string; name: string; timezone: string };
}) {
  try {
    const [reservation, orgAdmin] = await Promise.all([
      prisma.reservation.findUnique({
        where: { id: input.reservationId },
        select: {
          startAt: true,
          partySize: true,
          guest: {
            select: { id: true, fullName: true, email: true, phone: true }
          }
        }
      }),
      prisma.user.findFirst({
        where: {
          organizationId: input.venue.organizationId,
          isActive: true,
          adminRoles: { some: { role: 'ORGANIZATION_ADMIN', isActive: true } }
        },
        select: { email: true },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    if (!reservation) return;

    const guestEmail = reservation.guest.email;
    const guestName = reservation.guest.fullName ?? 'Guest';

    if (guestEmail) {
      void sendGuestConfirmation({
        to: guestEmail,
        guestName,
        venueName: input.venue.name,
        startAt: reservation.startAt,
        timezone: input.venue.timezone,
        partySize: reservation.partySize,
        statusCode: input.statusCode,
        reservationId: input.reservationId,
        organizationId: input.venue.organizationId,
        guestId: reservation.guest.id
      });
    }

    if (orgAdmin?.email) {
      void sendVenueNewReservationAlert({
        to: orgAdmin.email,
        venueName: input.venue.name,
        guestName,
        guestEmail,
        guestPhone: reservation.guest.phone,
        startAt: reservation.startAt,
        timezone: input.venue.timezone,
        partySize: reservation.partySize,
        source: 'Online booking',
        appUrl: env.APP_URL,
        reservationId: input.reservationId,
        organizationId: input.venue.organizationId,
        guestId: reservation.guest.id
      });
    }
  } catch (err) {
    console.error('Post-booking email error', err);
  }
}
