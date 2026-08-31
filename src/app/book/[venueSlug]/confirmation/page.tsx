import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicReservationConfirmation } from '@/server/public-booking/service';

function formatDateTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

export default async function BookingConfirmationPage({
  params,
  searchParams
}: {
  params: Promise<{ venueSlug: string }>;
  searchParams?: Promise<{ reservationId?: string }>;
}) {
  const { venueSlug } = await params;
  const reservationId = (await searchParams)?.reservationId ?? '';
  if (!reservationId) notFound();

  const reservation = await getPublicReservationConfirmation(
    venueSlug,
    reservationId
  );
  if (!reservation) notFound();

  const { venue, guest, status, startAt, partySize, specialRequests } =
    reservation;
  const isPending = status.code === 'PENDING';
  const guestName = guest.fullName ?? guest.firstName ?? 'Guest';

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <div className="border border-border bg-card p-8">
        <div className="eyebrow text-muted-foreground">
          {isPending ? 'Request received' : 'Confirmed'}
        </div>
        {isPending ? (
          <>
            <h1 className="mt-3 text-[26px] font-bold tracking-tightest">
              Booking request received
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Hi {guestName} — your request is pending review. {venue.name} will
              confirm it shortly.
              {guest.email
                ? ` A confirmation will be sent to ${guest.email}.`
                : ''}
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-[26px] font-bold tracking-tightest">
              Reservation confirmed
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              You&apos;re all set, {guestName}.
              {guest.email
                ? ` A confirmation has been sent to ${guest.email}.`
                : ''}
            </p>
          </>
        )}

        <dl className="mt-7 border-t border-border text-sm">
          <div className="flex justify-between gap-4 border-b border-border py-2.5">
            <dt className="text-muted-foreground">Venue</dt>
            <dd className="font-medium">{venue.name}</dd>
          </div>
          {(venue.addressLine || venue.city) && (
            <div className="flex justify-between gap-4 border-b border-border py-2.5">
              <dt className="text-muted-foreground">Address</dt>
              <dd className="text-right">
                {[venue.addressLine, venue.city].filter(Boolean).join(', ')}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-4 border-b border-border py-2.5">
            <dt className="text-muted-foreground">Date &amp; time</dt>
            <dd className="text-right">
              {formatDateTime(new Date(startAt), venue.timezone)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-border py-2.5">
            <dt className="text-muted-foreground">Party size</dt>
            <dd>
              {partySize} {partySize === 1 ? 'guest' : 'guests'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-border py-2.5">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <span className="border border-foreground px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]">
                {status.label}
              </span>
            </dd>
          </div>
          {specialRequests && (
            <div className="flex justify-between gap-4 border-b border-border py-2.5">
              <dt className="text-muted-foreground">Note</dt>
              <dd className="text-right">{specialRequests}</dd>
            </div>
          )}
        </dl>

        <p className="mt-6 text-sm text-muted-foreground">
          Need to make changes? Contact {venue.name} directly.
        </p>

        <Link
          href={`/book/${venue.slug}`}
          className="mt-4 inline-block text-sm font-medium text-foreground underline underline-offset-2 hover:opacity-70"
        >
          Make another reservation
        </Link>
      </div>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70">
        Powered by Floorbase
      </p>
    </main>
  );
}
