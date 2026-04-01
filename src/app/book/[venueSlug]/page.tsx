import { notFound } from 'next/navigation';
import { PublicBookingForm } from '@/components/public/public-booking-form';
import {
  getPublicVenueBySlug,
  PublicBookingError
} from '@/server/public-booking/service';

export default async function PublicBookingPage({
  params
}: {
  params: { venueSlug: string };
}) {
  try {
    const venue = await getPublicVenueBySlug(params.venueSlug);

    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Book {venue.name}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Select a date, choose an available time, and submit your details.
        </p>
        <div className="mt-6 rounded-lg border bg-white p-4">
          <PublicBookingForm
            venueSlug={venue.slug}
            maxOnlinePartySize={venue.maxOnlinePartySize}
            minPartySize={venue.minPartySize}
            publicInstructions={venue.publicInstructions}
            venueTimezone={venue.timezone}
          />
        </div>
      </main>
    );
  } catch (error) {
    if (
      error instanceof PublicBookingError &&
      error.code === 'VENUE_NOT_AVAILABLE'
    ) {
      notFound();
    }

    throw error;
  }
}
