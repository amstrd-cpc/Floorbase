import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_STATUSES = [
  { code: 'PENDING', label: 'Pending', sortOrder: 10, isDefault: true, color: '#f59e0b' },
  { code: 'CONFIRMED', label: 'Confirmed', sortOrder: 20, isDefault: false, color: '#16a34a' },
  { code: 'SEATED', label: 'Seated', sortOrder: 30, isDefault: false, color: '#2563eb' },
  { code: 'COMPLETED', label: 'Completed', sortOrder: 40, isDefault: false, color: '#6b7280' },
  { code: 'NO_SHOW', label: 'No Show', sortOrder: 50, isDefault: false, color: '#dc2626' },
  { code: 'CANCELED', label: 'Canceled', sortOrder: 60, isDefault: false, color: '#7c3aed' }
] as const;

async function seedReservationStatuses() {
  const organizations = await prisma.organization.findMany({ select: { id: true } });

  for (const organization of organizations) {
    for (const status of DEFAULT_STATUSES) {
      await prisma.reservationStatus.upsert({
        where: {
          organizationId_code: {
            organizationId: organization.id,
            code: status.code
          }
        },
        update: {
          label: status.label,
          color: status.color,
          sortOrder: status.sortOrder
        },
        create: {
          organizationId: organization.id,
          code: status.code,
          label: status.label,
          color: status.color,
          sortOrder: status.sortOrder,
          isDefault: status.isDefault
        }
      });
    }
  }
}

async function main() {
  await seedReservationStatuses();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
