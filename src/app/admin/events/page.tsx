import { BookingEventsManager } from '@/components/admin/booking-events-manager';
import { PageHeader } from '@/components/admin/page-header';
import { getAdminContext } from '@/server/auth/admin-context';

export default async function EventsPage() {
  const { venueId } = await getAdminContext();
  if (!venueId) return <p>Missing venue scope.</p>;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Events"
        description="Create temporary and recurring booking overrides for holidays, special services, or operational exceptions."
      />
      <BookingEventsManager venueId={venueId} />
    </div>
  );
}
