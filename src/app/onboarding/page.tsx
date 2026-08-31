import { redirect } from 'next/navigation';
import { getAdminContext } from '@/server/auth/admin-context';
import { prisma } from '@/server/db/prisma/client';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';

export default async function OnboardingPage() {
  const { organizationId, venueId } = await getAdminContext();

  const [org, venue] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { onboardingComplete: true }
    }),
    prisma.venue.findUnique({
      where: { id: venueId },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        city: true,
        country: true,
        addressLine: true
      }
    })
  ]);

  if (!org || !venue) redirect('/login');
  if (org.onboardingComplete) redirect('/admin');

  return (
    <OnboardingWizard
      venueId={venue.id}
      orgId={organizationId}
      venueName={venue.name}
      venueSlug={venue.slug}
      timezone={venue.timezone}
      city={venue.city}
      country={venue.country}
      addressLine={venue.addressLine}
    />
  );
}
