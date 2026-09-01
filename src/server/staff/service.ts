import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma/client';
import { hashPassword, verifyPassword } from '@/server/auth/password';
import { checkRateLimit } from '@/server/rate-limit';
import { StaffNotFoundError, StaffValidationError } from './errors';
import {
  type CreateStaffMemberInput,
  type StaffPinInput,
  type UpdateStaffMemberInput,
  createStaffMemberSchema,
  listStaffSchema,
  staffPinSchema,
  updateStaffMemberSchema
} from './validation';

function mapZodErrors(
  issues: Array<{ path: Array<string | number>; message: string }>
) {
  return Object.fromEntries(
    issues.map((issue) => [issue.path.join('.') || 'root', issue.message])
  );
}

function toValidationError(error: unknown) {
  if (
    error instanceof StaffValidationError ||
    error instanceof StaffNotFoundError
  ) {
    return error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      return new StaffNotFoundError();
    }
  }

  return new StaffValidationError('Invalid staff payload.');
}

// pinHash is never selected into any response - staff records are read
// through this shape everywhere.
const staffSelect = {
  id: true,
  venueId: true,
  userId: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.StaffMemberSelect;

async function assertVenue(venueId: string) {
  const venue = await prisma.venue.findFirst({
    where: { id: venueId, isActive: true },
    select: { id: true }
  });
  if (!venue) {
    throw new StaffValidationError('Venue does not exist or is inactive.');
  }
}

export async function listStaff(input: { venueId: string }) {
  const parsed = listStaffSchema.safeParse(input);
  if (!parsed.success) {
    throw new StaffValidationError(
      'Invalid query params.',
      mapZodErrors(parsed.error.issues)
    );
  }

  await assertVenue(parsed.data.venueId);

  return prisma.staffMember.findMany({
    where: { venueId: parsed.data.venueId },
    select: staffSelect,
    orderBy: { name: 'asc' }
  });
}

export async function createStaffMember(payload: CreateStaffMemberInput) {
  try {
    const parsed = createStaffMemberSchema.safeParse(payload);
    if (!parsed.success) {
      throw new StaffValidationError(
        'Staff payload validation failed.',
        mapZodErrors(parsed.error.issues)
      );
    }

    await assertVenue(parsed.data.venueId);
    const pinHash = await hashPassword(parsed.data.pin);

    return await prisma.staffMember.create({
      data: {
        venueId: parsed.data.venueId,
        name: parsed.data.name,
        pinHash,
        isActive: parsed.data.isActive ?? true
      },
      select: staffSelect
    });
  } catch (error) {
    throw toValidationError(error);
  }
}

export async function updateStaffMember(input: {
  staffMemberId: string;
  payload: UpdateStaffMemberInput;
}) {
  try {
    const parsed = updateStaffMemberSchema.safeParse(input.payload);
    if (!parsed.success) {
      throw new StaffValidationError(
        'Staff payload validation failed.',
        mapZodErrors(parsed.error.issues)
      );
    }

    const current = await prisma.staffMember.findUnique({
      where: { id: input.staffMemberId }
    });
    if (!current) {
      throw new StaffNotFoundError();
    }

    const pinHash = parsed.data.pin
      ? await hashPassword(parsed.data.pin)
      : current.pinHash;

    return await prisma.staffMember.update({
      where: { id: current.id },
      data: {
        name: parsed.data.name ?? current.name,
        isActive: parsed.data.isActive ?? current.isActive,
        pinHash
      },
      select: staffSelect
    });
  } catch (error) {
    throw toValidationError(error);
  }
}

async function verifyStaffPin(staffMemberId: string, pin: string) {
  // Keyed per staff member, not per caller/IP - the caller is already an
  // authenticated admin session (shared terminal); this guards against PIN
  // brute-forcing a specific staff member, which is the actual weak point
  // of a short numeric PIN.
  const rate = await checkRateLimit({
    key: `staff-clock:${staffMemberId}`,
    limit: 8,
    windowMs: 5 * 60_000
  });
  if (!rate.allowed) {
    throw new StaffValidationError(
      'Too many attempts. Please wait a few minutes and try again.'
    );
  }

  const staff = await prisma.staffMember.findUnique({
    where: { id: staffMemberId }
  });
  if (!staff) {
    throw new StaffNotFoundError();
  }
  if (!staff.isActive) {
    throw new StaffValidationError('This staff member is not active.');
  }

  const valid = await verifyPassword(pin, staff.pinHash);
  if (!valid) {
    throw new StaffValidationError('Incorrect PIN.');
  }

  return staff;
}

export async function clockIn(input: { staffMemberId: string; payload: StaffPinInput }) {
  const parsed = staffPinSchema.safeParse(input.payload);
  if (!parsed.success) {
    throw new StaffValidationError(
      'Invalid PIN.',
      mapZodErrors(parsed.error.issues)
    );
  }

  const staff = await verifyStaffPin(input.staffMemberId, parsed.data.pin);

  const openShift = await prisma.shift.findFirst({
    where: { staffMemberId: staff.id, clockOutAt: null }
  });
  if (openShift) {
    throw new StaffValidationError('This staff member is already clocked in.');
  }

  return prisma.shift.create({
    data: { staffMemberId: staff.id, venueId: staff.venueId }
  });
}

export async function clockOut(input: { staffMemberId: string; payload: StaffPinInput }) {
  const parsed = staffPinSchema.safeParse(input.payload);
  if (!parsed.success) {
    throw new StaffValidationError(
      'Invalid PIN.',
      mapZodErrors(parsed.error.issues)
    );
  }

  const staff = await verifyStaffPin(input.staffMemberId, parsed.data.pin);

  const openShift = await prisma.shift.findFirst({
    where: { staffMemberId: staff.id, clockOutAt: null }
  });
  if (!openShift) {
    throw new StaffValidationError('This staff member is not clocked in.');
  }

  return prisma.shift.update({
    where: { id: openShift.id },
    data: { clockOutAt: new Date() }
  });
}

export async function listShifts(input: { venueId: string; activeOnly?: boolean }) {
  const parsed = listStaffSchema.safeParse({ venueId: input.venueId });
  if (!parsed.success) {
    throw new StaffValidationError(
      'Invalid query params.',
      mapZodErrors(parsed.error.issues)
    );
  }

  await assertVenue(parsed.data.venueId);

  return prisma.shift.findMany({
    where: {
      venueId: parsed.data.venueId,
      ...(input.activeOnly ? { clockOutAt: null } : {})
    },
    include: { staffMember: { select: staffSelect } },
    orderBy: { clockInAt: 'desc' },
    take: 100
  });
}
