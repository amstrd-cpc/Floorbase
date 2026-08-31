import { PageHeader } from '@/components/admin/page-header';
import { SectionCard } from '@/components/admin/section-card';
import { BusinessHoursForm } from '@/components/admin/business-hours-form';
import { getAdminContext } from '@/server/auth/admin-context';
import { prisma } from '@/server/db/prisma/client';

const DEFAULT_HOURS = [
  { dayOfWeek: 0, isClosed: false, openTime: '11:00', closeTime: '21:00' },
  { dayOfWeek: 1, isClosed: false, openTime: '11:30', closeTime: '22:00' },
  { dayOfWeek: 2, isClosed: false, openTime: '11:30', closeTime: '22:00' },
  { dayOfWeek: 3, isClosed: false, openTime: '11:30', closeTime: '22:00' },
  { dayOfWeek: 4, isClosed: false, openTime: '11:30', closeTime: '23:00' },
  { dayOfWeek: 5, isClosed: false, openTime: '10:30', closeTime: '23:00' },
  { dayOfWeek: 6, isClosed: false, openTime: '10:30', closeTime: '21:30' }
];

export default async function HoursSettingsPage() {
  const { venueId } = await getAdminContext();
  if (!venueId) return <p>Missing venue scope.</p>;

  const dbHours = await prisma.businessHours.findMany({
    where: { venueId },
    orderBy: { dayOfWeek: 'asc' }
  });

  // Merge DB rows over defaults so all 7 days are always present.
  const hoursMap = new Map(dbHours.map((h) => [h.dayOfWeek, h]));
  const hours = DEFAULT_HOURS.map((d) => {
    const row = hoursMap.get(d.dayOfWeek);
    return row
      ? {
          dayOfWeek: row.dayOfWeek,
          isClosed: row.isClosed,
          openTime: row.openTime,
          closeTime: row.closeTime
        }
      : d;
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Business Hours"
        description="Set your regular weekly operating hours. These are used for availability checks."
      />
      <SectionCard title="Weekly schedule">
        <BusinessHoursForm initialHours={hours} />
      </SectionCard>
    </div>
  );
}
