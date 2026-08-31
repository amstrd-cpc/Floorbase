import { PageHeader } from '@/components/admin/page-header';
import { VenueSettingsForm } from '@/components/admin/venue-settings-form';
import { CopyButton } from '@/components/admin/copy-button';
import { getAdminContext } from '@/server/auth/admin-context';
import { prisma } from '@/server/db/prisma/client';
import { env } from '@/env';

export default async function SettingsPage() {
  const { venueId } = await getAdminContext();
  if (!venueId) return <p>Missing venue scope.</p>;

  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) return <p>Venue not found.</p>;

  const bookingUrl = venue.publicBookingEnabled
    ? `${env.APP_URL}/book/${venue.slug}`
    : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Venue Settings"
        description="Manage your venue identity, location, regional details, and default booking behavior."
      />

      {bookingUrl && (
        <div className="border border-border bg-card p-4">
          <p className="text-sm font-medium">Public booking link</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-slate-100 px-3 py-1.5 text-sm">
              {bookingUrl}
            </code>
            <CopyButton text={bookingUrl} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Share this link with guests to let them book online.
          </p>
        </div>
      )}

      <VenueSettingsForm
        venue={{
          id: venue.id,
          name: venue.name,
          slug: venue.slug,
          country: venue.country,
          city: venue.city,
          addressLine: venue.addressLine,
          timezone: venue.timezone,
          currency: venue.currency,
          isActive: venue.isActive,
          publicBookingEnabled: venue.publicBookingEnabled,
          bookingMode: venue.bookingMode,
          placementMode: venue.placementMode,
          minPartySize: venue.minPartySize,
          maxOnlinePartySize: venue.maxOnlinePartySize,
          minAdvanceNoticeMinutes: venue.minAdvanceNoticeMinutes,
          maxDaysAhead: venue.maxDaysAhead,
          defaultReservationDurationMinutes:
            venue.defaultReservationDurationMinutes,
          publicInstructions: venue.publicInstructions
        }}
      />
    </div>
  );
}
