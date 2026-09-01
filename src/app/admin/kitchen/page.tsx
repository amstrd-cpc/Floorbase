import { KitchenDisplay } from '@/components/admin/kitchen-display';
import { PageHeader } from '@/components/admin/page-header';
import { getAdminContext } from '@/server/auth/admin-context';

export default async function KitchenPage() {
  const { venueId } = await getAdminContext();
  if (!venueId) return <p>Missing venue scope.</p>;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Kitchen"
        description="Live tickets for open orders. Tap an item to bump it, or bump the whole ticket."
      />
      <KitchenDisplay venueId={venueId} />
    </div>
  );
}
