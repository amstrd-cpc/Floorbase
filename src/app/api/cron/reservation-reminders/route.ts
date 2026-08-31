import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma/client';
import { sendGuestReminder } from '@/server/email/service';
import { env } from '@/env';

export const dynamic = 'force-dynamic';

// Vercel Hobby plan only allows daily cron (see vercel.json), not hourly.
// With a 24h-apart cadence, a plain 24h window can catch a reservation right
// at the edge and only remind it a few minutes before start instead of a day
// ahead. 30h guarantees at least ~6h notice on every run at that cadence.
const REMINDER_WINDOW_HOURS = 30;
// ponytail: a flat cap instead of pagination — fine at expected reminder
// volume per run; paginate if a single run regularly hits this.
const MAX_REMINDERS_PER_RUN = 200;

export async function GET(request: Request) {
  if (env.CRON_SECRET) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const now = new Date();
  const windowEnd = new Date(
    now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60_000
  );

  const candidates = await prisma.reservation.findMany({
    where: {
      bookingStatus: { in: ['PENDING', 'CONFIRMED'] },
      startAt: { gt: now, lte: windowEnd },
      notifications: { none: { templateKey: 'reservation_reminder' } }
    },
    select: {
      id: true,
      organizationId: true,
      guestId: true,
      startAt: true,
      partySize: true,
      guest: { select: { fullName: true, email: true } },
      venue: { select: { name: true, timezone: true } }
    },
    take: MAX_REMINDERS_PER_RUN
  });

  let sent = 0;
  for (const reservation of candidates) {
    // ponytail: guests with no email are re-checked every run rather than
    // logged as skipped — SMS/WhatsApp reminders are out of scope for now,
    // and this is cheap at the volumes a single cron run sees.
    if (!reservation.guest.email) continue;

    await sendGuestReminder({
      to: reservation.guest.email,
      guestName: reservation.guest.fullName ?? 'Guest',
      venueName: reservation.venue.name,
      startAt: reservation.startAt,
      timezone: reservation.venue.timezone,
      partySize: reservation.partySize,
      reservationId: reservation.id,
      organizationId: reservation.organizationId,
      guestId: reservation.guestId
    });
    sent += 1;
  }

  return NextResponse.json({ checked: candidates.length, sent });
}
