import { redirect } from 'next/navigation';
import { requireRole } from '@/server/auth/authorization';
import { getAdminContext } from '@/server/auth/admin-context';
import { prisma } from '@/server/db/prisma/client';
import { getActiveVenueCount } from '@/server/billing/service';
import { PageHeader } from '@/components/admin/page-header';
import { BillingActions } from '@/components/admin/billing-actions';

const STATUS_LABELS: Record<string, string> = {
  TRIALING: 'Free trial',
  ACTIVE: 'Active',
  PAST_DUE: 'Payment overdue',
  CANCELLED: 'Cancelled'
};

function planTier(venueCount: number): string {
  if (venueCount <= 1) return 'Starter';
  if (venueCount <= 5) return 'Growth';
  if (venueCount <= 15) return 'Scale';
  return 'Enterprise';
}

export default async function BillingPage({
  searchParams
}: {
  searchParams?: Promise<{ success?: string }>;
}) {
  const user = await requireRole(['SUPER_ADMIN', 'ORGANIZATION_ADMIN']);
  const isSuperAdmin = user.adminRoles.some(
    (r: { role: string }) => r.role === 'SUPER_ADMIN'
  );
  if (isSuperAdmin) redirect('/admin');

  const { organizationId } = await getAdminContext();

  const [org, venueCount] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        name: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        subscriptionId: true,
        planId: true
      }
    }),
    getActiveVenueCount(organizationId)
  ]);

  const justSubscribed = (await searchParams)?.success === '1';
  const isExpiredTrial =
    org.subscriptionStatus === 'TRIALING' &&
    org.trialEndsAt &&
    org.trialEndsAt < new Date();

  const statusLabel =
    STATUS_LABELS[org.subscriptionStatus] ?? org.subscriptionStatus;
  const tier = planTier(venueCount);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Manage your subscription and plan."
      />

      {justSubscribed && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Subscription activated. Welcome aboard!
        </div>
      )}

      <div className="space-y-4 border border-border bg-card p-6">
        <h2 className="font-medium">Current plan</h2>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <dt className="text-muted-foreground">Organization</dt>
          <dd>{org.name}</dd>

          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <span
              className={
                org.subscriptionStatus === 'ACTIVE'
                  ? 'font-medium text-green-700'
                  : org.subscriptionStatus === 'PAST_DUE'
                    ? 'font-medium text-red-700'
                    : 'font-medium'
              }
            >
              {statusLabel}
            </span>
          </dd>

          {org.trialEndsAt && org.subscriptionStatus === 'TRIALING' && (
            <>
              <dt className="text-muted-foreground">Trial ends</dt>
              <dd>{org.trialEndsAt.toLocaleDateString()}</dd>
            </>
          )}

          <dt className="text-muted-foreground">Active venues</dt>
          <dd>{venueCount}</dd>

          <dt className="text-muted-foreground">Plan tier</dt>
          <dd>{tier}</dd>
        </dl>

        {(org.subscriptionStatus !== 'ACTIVE' || isExpiredTrial) && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <strong>Pricing:</strong> $49/venue/month for 1 venue ·
            $39/venue/month for 2–5 venues · $29/venue/month for 6–15 venues
          </div>
        )}

        <BillingActions hasSubscription={Boolean(org.subscriptionId)} />
      </div>
    </div>
  );
}
