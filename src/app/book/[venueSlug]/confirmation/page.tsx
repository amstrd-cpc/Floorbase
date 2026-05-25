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
    minute: '2-digit',
  }).format(date);
}

export default async function BookingConfirmationPage({
  params,
  searchParams,
}: {
  params: { venueSlug: string };
  searchParams?: { reservationId?: string };
}) {
  const reservationId = searchParams?.reservationId ?? '';
  if (!reservationId) notFound();

  const reservation = await getPublicReservationConfirmation(params.venueSlug, reservationId);
  if (!reservation) notFound();

  const { venue, guest, status, startAt, partySize, specialRequests } = reservation;
  const isPending = status.code === 'PENDING';
  const guestName = guest.fullName ?? guest.firstName ?? 'Guest';

  return (
    <main className="mx-auto max-w-xl p-6">
      <div className="rounded-lg border bg-white p-8 shadow-sm">
        {isPending ? (
          <>
            <div className="text-2xl font-semibold">Booking request received</div>
            <p className="mt-2 text-slate-600">
              Hi {guestName} — your request is pending review. {venue.name} will confirm it shortly.
              {guest.email ? ` A confirmation will be sent to ${guest.email}.` : ''}
            </p>
          </>
        ) : (
          <>
            <div className="text-2xl font-semibold text-emerald-700">Reservation confirmed</div>
            <p className="mt-2 text-slate-600">
              You&apos;re all set, {guestName}.
              {guest.email ? ` A confirmation has been sent to ${guest.email}.` : ''}
            </p>
          </>
        )}

        <div className="mt-6 space-y-2 rounded-md border bg-slate-50 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Venue</span>
            <span className="font-medium">{venue.name}</span>
          </div>
          {(venue.addressLine || venue.city) && (
            <div className="flex justify-between">
              <span className="text-slate-500">Address</span>
              <span>{[venue.addressLine, venue.city].filter(Boolean).join(', ')}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">Date &amp; time</span>
            <span>{formatDateTime(new Date(startAt), venue.timezone)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Party size</span>
            <span>{partySize} {partySize === 1 ? 'guest' : 'guests'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Status</span>
            <span
              className={
                isPending
                  ? 'font-medium text-amber-700'
                  : 'font-medium text-emerald-700'
              }
            >
              {status.label}
            </span>
          </div>
          {specialRequests && (
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Note</span>
              <span className="text-right">{specialRequests}</span>
            </div>
          )}
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Need to make changes? Contact {venue.name} directly.
        </p>

        <Link
          href={`/book/${venue.slug}`}
          className="mt-4 inline-block text-sm underline text-slate-600"
        >
          Make another reservation
        </Link>
      </div>
    </main>
  );
}
