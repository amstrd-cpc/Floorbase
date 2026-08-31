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
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="eyebrow text-muted-foreground">Online reservations</div>
        <h1 className="mt-3 text-[clamp(28px,5vw,40px)] font-bold tracking-tightest">
          Book {venue.name}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Select a date, choose an available time, and submit your details.
        </p>
        <div className="mt-8 border border-border bg-card p-6">
          <PublicBookingForm
            venueSlug={venue.slug}
            maxOnlinePartySize={venue.maxOnlinePartySize}
            minPartySize={venue.minPartySize}
            publicInstructions={venue.publicInstructions}
            venueTimezone={venue.timezone}
          />
        </div>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70">
          Powered by Floorbase
        </p>
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
