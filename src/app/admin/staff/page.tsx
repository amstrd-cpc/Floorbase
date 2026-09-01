import { StaffManager } from '@/components/admin/staff-manager';
import { PageHeader } from '@/components/admin/page-header';
import { getAdminContext } from '@/server/auth/admin-context';

export default async function StaffPage() {
  const { venueId } = await getAdminContext();
  if (!venueId) return <p>Missing venue scope.</p>;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff"
        description="Manage staff members and track clock-in/out shifts."
      />
      <StaffManager venueId={venueId} />
    </div>
  );
}
