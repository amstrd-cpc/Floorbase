import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/admin/admin-nav';
import { BillingBanner } from '@/components/admin/billing-banner';
import { BillingActions } from '@/components/admin/billing-actions';
import { VenueSwitcher } from '@/components/admin/venue-switcher';
import { getAdminContext } from '@/server/auth/admin-context';
import { prisma } from '@/server/db/prisma/client';

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
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
          subscriptionId: true
        }
      }),
      prisma.venue.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' }
      })
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
    <div className="flex min-h-screen bg-secondary">
      {/* Sidebar */}
      <aside className="sticky top-0 flex h-screen w-[236px] shrink-0 flex-col border-r border-border bg-background">
        <div className="border-b border-border px-[22px] py-5">
          <span className="flex items-center gap-2.5">
            <span
              className="relative inline-block h-[17px] w-[17px]"
              aria-hidden="true"
            >
              <span className="absolute inset-0 bg-foreground" />
              <span className="absolute bottom-0 right-0 h-1/2 w-1/2 rounded-full bg-background" />
            </span>
            <span className="text-[16px] font-bold tracking-tightest">
              Floorbase
            </span>
          </span>
          <div className="ml-[27px] mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground/70">
            Admin
          </div>
        </div>

        <AdminNav />

        <div className="space-y-3 border-t border-border p-3.5">
          <VenueSwitcher venues={venues} activeVenueId={venueId} />
          <div className="flex items-center gap-2.5 px-1">
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
              {(user.email[0] ?? 'U').toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-semibold">
                {user.email}
              </span>
              <form action="/api/auth/logout" method="post">
                <button
                  className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70 hover:text-foreground"
                  type="submit"
                >
                  Sign out
                </button>
              </form>
            </span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {org && (
          <BillingBanner
            status={org.subscriptionStatus}
            trialEndsAt={org.trialEndsAt}
          />
        )}

        {isBillingWall ? (
          <main className="mx-auto w-full max-w-6xl p-5 md:p-8">
            <div className="space-y-4 border border-border bg-card p-8 text-center">
              <h2 className="text-xl font-bold tracking-tight">
                {isExpiredTrial
                  ? 'Your free trial has ended'
                  : 'Your subscription has ended'}
              </h2>
              <p className="text-sm text-muted-foreground">
                Subscribe to restore access to your dashboard and reservation
                data.
              </p>
              <div className="flex justify-center">
                <BillingActions
                  hasSubscription={Boolean(org?.subscriptionId)}
                />
              </div>
            </div>
          </main>
        ) : (
          <main className="mx-auto w-full max-w-6xl p-5 md:p-8">
            {children}
          </main>
        )}
      </div>
    </div>
  );
}
