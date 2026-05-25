import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/admin/admin-nav';
import { BillingBanner } from '@/components/admin/billing-banner';
import { BillingActions } from '@/components/admin/billing-actions';
import { VenueSwitcher } from '@/components/admin/venue-switcher';
import { getAdminContext } from '@/server/auth/admin-context';
import { prisma } from '@/server/db/prisma/client';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, organizationId, venueId } = await getAdminContext();

  const isSuperAdmin = user.adminRoles.some((r) => r.role === 'SUPER_ADMIN');

  let org: {
    onboardingComplete: boolean;
    subscriptionStatus: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
    trialEndsAt: Date | null;
    subscriptionId: string | null;
  } | null = null;

  let venues: { id: string; name: string }[] = [];

  if (organizationId && !isSuperAdmin) {
    [org, venues] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          onboardingComplete: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          subscriptionId: true,
        },
      }),
      prisma.venue.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (org && !org.onboardingComplete) {
      redirect('/onboarding');
    }
  }

  const isExpiredTrial =
    org?.subscriptionStatus === 'TRIALING' &&
    org.trialEndsAt != null &&
    org.trialEndsAt < new Date();

  const isBillingWall =
    !isSuperAdmin &&
    org != null &&
    (org.subscriptionStatus === 'CANCELLED' || isExpiredTrial);

  return (
    <div className="min-h-screen bg-slate-100">
      {org && (
        <BillingBanner
          status={org.subscriptionStatus}
          trialEndsAt={org.trialEndsAt}
        />
      )}
      <header className="border-b bg-white px-4 py-4 md:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold">Floorbase Admin</h1>
              <p className="text-xs text-muted-foreground">Signed in as {user.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <VenueSwitcher venues={venues} activeVenueId={venueId} />
              <form action="/api/auth/logout" method="post">
                <button className="rounded border px-3 py-1 text-sm" type="submit">
                  Sign out
                </button>
              </form>
            </div>
          </div>
          <AdminNav />
        </div>
      </header>

      {isBillingWall ? (
        <main className="mx-auto w-full max-w-7xl p-4 md:p-6">
          <div className="rounded-lg border bg-card p-8 shadow-sm space-y-4 text-center">
            <h2 className="text-xl font-semibold">
              {isExpiredTrial ? 'Your free trial has ended' : 'Your subscription has ended'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Subscribe to restore access to your dashboard and reservation data.
            </p>
            <div className="flex justify-center">
              <BillingActions hasSubscription={Boolean(org?.subscriptionId)} />
            </div>
          </div>
        </main>
      ) : (
        <main className="mx-auto w-full max-w-7xl p-4 md:p-6">{children}</main>
      )}
    </div>
  );
}
