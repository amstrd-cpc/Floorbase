import { OrdersManager } from '@/components/admin/orders-manager';
import { PageHeader } from '@/components/admin/page-header';
import { getAdminContext } from '@/server/auth/admin-context';

export default async function OrdersPage() {
  const { venueId } = await getAdminContext();
  if (!venueId) return <p>Missing venue scope.</p>;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Orders"
        description="Open tickets, add items from the menu, and close them out."
      />
      <OrdersManager venueId={venueId} />
    </div>
  );
}
