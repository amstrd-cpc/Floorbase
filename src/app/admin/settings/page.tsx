import { PageHeader } from '@/components/admin/page-header';
import { VenueSettingsForm } from '@/components/admin/venue-settings-form';
import { getAdminContext } from '@/server/auth/admin-context';
import { prisma } from '@/server/db/prisma/client';

export default async function SettingsPage() {
  const { venueId } = await getAdminContext();
  if (!venueId) return <p>Missing venue scope.</p>;

  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) return <p>Venue not found.</p>;

  return (
    <div className="space-y-4">
      <PageHeader title="Venue Settings" description="Basic properties for daily operations configuration." />
      <VenueSettingsForm venue={{ id: venue.id, name: venue.name, slug: venue.slug, timezone: venue.timezone, currency: venue.currency, isActive: venue.isActive }} />
    </div>
  );
}
