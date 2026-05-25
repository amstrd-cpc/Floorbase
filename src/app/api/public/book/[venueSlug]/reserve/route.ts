import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/server/public-booking/rate-limit';
import {
  createPublicBooking,
  getPublicVenueBySlug,
  PublicBookingError
} from '@/server/public-booking/service';

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
  // Take only the leftmost IP from x-forwarded-for to prevent spoofing via
  // appending arbitrary IPs to the header chain.
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const rate = checkRateLimit({
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

  try {
    const venue = await getPublicVenueBySlug(params.venueSlug);
    const payload = await request.json();
    const result = await createPublicBooking({ venue, payload });

    const modeMessage =
      result.statusCode === 'CONFIRMED'
        ? 'Your reservation is confirmed.'
        : 'Your booking request was received and is pending review.';

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
