import { NextResponse } from 'next/server';
import {
  getPublicSlots,
  getPublicVenueBySlug,
  PublicBookingError
} from '@/server/public-booking/service';
import { checkRateLimit } from '@/server/public-booking/rate-limit';

function toErrorResponse(error: unknown) {
  if (error instanceof PublicBookingError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }

  console.error('Public booking slots error', error);
  return NextResponse.json(
    { error: 'Unable to load availability right now.' },
    { status: 500 }
  );
}

export async function GET(
  request: Request,
  { params }: { params: { venueSlug: string } }
) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const partySize = Number(url.searchParams.get('partySize') ?? '0');

  if (!date || !partySize) {
    return NextResponse.json(
      { error: 'date and partySize are required.', code: 'INVALID_INPUT' },
      { status: 400 }
    );
  }

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  const rate = checkRateLimit({
    key: `slots:${params.venueSlug}:${ip}`,
    limit: 60,
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
    const resolved = await getPublicSlots({
      venue,
      dateText: date,
      partySize
    });

    return NextResponse.json({
      timezone: venue.timezone,
      config: resolved.resolvedConfig,
      layout: resolved.layout,
      slots: resolved.slots.map((slot) => ({
        startAt: slot.startAt.toISOString(),
        endAt: slot.endAt.toISOString(),
        localStartAt: slot.localStartAt,
        availableTables: slot.availableTables,
        tableStates: slot.tableStates
      }))
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
