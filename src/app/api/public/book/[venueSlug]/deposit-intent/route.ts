import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/server/rate-limit';
import { createDepositPaymentIntent } from '@/server/deposits/service';
import { DepositError } from '@/server/deposits/errors';

const bodySchema = z
  .object({
    reservationId: z.string().cuid()
  })
  .strict();

export async function POST(
  request: Request,
  { params }: { params: { venueSlug: string } }
) {
  const ip =
    (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    'unknown';
  const rate = await checkRateLimit({
    key: `deposit-intent:${params.venueSlug}:${ip}`,
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

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'A valid reservationId is required.' },
      { status: 400 }
    );
  }

  try {
    const result = await createDepositPaymentIntent({
      venueSlug: params.venueSlug,
      reservationId: parsed.data.reservationId
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DepositError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error('Deposit payment intent error', error);
    return NextResponse.json(
      { error: 'We could not start payment for this deposit right now.' },
      { status: 500 }
    );
  }
}
