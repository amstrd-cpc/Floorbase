import { MenuManager } from '@/components/admin/menu-manager';
import { PageHeader } from '@/components/admin/page-header';
import { getAdminContext } from '@/server/auth/admin-context';

export default async function MenuPage() {
  const { venueId } = await getAdminContext();
  if (!venueId) return <p>Missing venue scope.</p>;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Menu"
        description="Manage the categories and items that make up this venue's menu."
      />
      <MenuManager venueId={venueId} />
    </div>
  );
}
