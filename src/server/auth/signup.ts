import { prisma } from '@/server/db/prisma/client';
import { hashPassword } from './password';
import { isValidIanaTimeZone } from '@/lib/timezone';

const DEFAULT_STATUSES = [
  { code: 'PENDING',   label: 'Pending',   color: '#f59e0b', sortOrder: 10, isDefault: true  },
  { code: 'CONFIRMED', label: 'Confirmed', color: '#16a34a', sortOrder: 20, isDefault: false },
  { code: 'SEATED',    label: 'Seated',    color: '#2563eb', sortOrder: 30, isDefault: false },
  { code: 'COMPLETED', label: 'Completed', color: '#6b7280', sortOrder: 40, isDefault: false },
  { code: 'NO_SHOW',   label: 'No Show',   color: '#dc2626', sortOrder: 50, isDefault: false },
  { code: 'CANCELLED', label: 'Cancelled', color: '#9ca3af', sortOrder: 60, isDefault: false },
];

function toSlug(name: string, suffix: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) +
    '-' +
    suffix
  );
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export class SignupError extends Error {
  constructor(
    public readonly code: 'EMAIL_TAKEN' | 'INVALID_INPUT',
    message: string
  ) {
    super(message);
  }
}

export async function createAccount(input: {
  email: string;
  password: string;
  orgName: string;
  venueName: string;
  timezone: string;
}): Promise<{ userId: string; orgId: string; venueId: string }> {
  const email = input.email.trim().toLowerCase();
  const orgName = input.orgName.trim();
  const venueName = input.venueName.trim();

  if (!email || !orgName || !venueName || !input.timezone) {
    throw new SignupError('INVALID_INPUT', 'All fields are required.');
  }

  if (!isValidIanaTimeZone(input.timezone)) {
    throw new SignupError('INVALID_INPUT', 'Invalid timezone.');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new SignupError('EMAIL_TAKEN', 'An account with that email already exists.');
  }

  const passwordHash = await hashPassword(input.password);
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const suffix = randomSuffix();

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: orgName,
        slug: toSlug(orgName, suffix),
        onboardingComplete: false,
        trialEndsAt,
        subscriptionStatus: 'TRIALING',
      },
    });

    const venue = await tx.venue.create({
      data: {
        organizationId: org.id,
        name: venueName,
        slug: toSlug(venueName, suffix),
        timezone: input.timezone,
        isActive: true,
        publicBookingEnabled: false,
      },
    });

    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        organizationId: org.id,
        isActive: true,
      },
    });

    const scopeKey = `${user.id}:ORGANIZATION_ADMIN:${org.id}:global`;
    await tx.adminRoleAssignment.create({
      data: {
        userId: user.id,
        role: 'ORGANIZATION_ADMIN',
        organizationId: org.id,
        scopeKey,
        isActive: true,
      },
    });

    for (const status of DEFAULT_STATUSES) {
      await tx.reservationStatus.create({
        data: {
          organizationId: org.id,
          code: status.code,
          label: status.label,
          color: status.color,
          sortOrder: status.sortOrder,
          isDefault: status.isDefault,
        },
      });
    }

    return { userId: user.id, orgId: org.id, venueId: venue.id };
  });
}
