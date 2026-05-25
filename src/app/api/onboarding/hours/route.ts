import { NextResponse } from 'next/server';
import { getAdminContext } from '@/server/auth/admin-context';
import { prisma } from '@/server/db/prisma/client';
import { z } from 'zod';

const daySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isClosed: z.boolean(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
}).refine(
  (d) => d.isClosed || d.openTime < d.closeTime,
  { message: 'openTime must be before closeTime' }
);

const schema = z.object({
  hours: z.array(daySchema).length(7),
});

export async function POST(request: Request) {
  const { venueId } = await getAdminContext();

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid hours payload.' }, { status: 400 });
  }

  await prisma.$transaction(
    parsed.data.hours.map((day) =>
      prisma.businessHours.upsert({
        where: { venueId_dayOfWeek: { venueId, dayOfWeek: day.dayOfWeek } },
        update: { isClosed: day.isClosed, openTime: day.openTime, closeTime: day.closeTime },
        create: {
          venueId,
          dayOfWeek: day.dayOfWeek,
          isClosed: day.isClosed,
          openTime: day.openTime,
          closeTime: day.closeTime,
        },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
