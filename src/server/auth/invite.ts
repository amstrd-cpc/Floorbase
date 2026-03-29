import { createHash, randomBytes } from 'crypto';
import { AdminRole } from '@prisma/client';
import { env } from '@/env';
import { prisma } from '@/server/db/prisma/client';
import { hashPassword } from './password';

function hashInviteToken(rawToken: string) {
  return createHash('sha256')
    .update(`${rawToken}.${env.AUTH_SESSION_SECRET}`)
    .digest('hex');
}

export async function createInvite(input: {
  email: string;
  role: AdminRole;
  invitedByUserId?: string;
  organizationId?: string;
  venueId?: string;
}) {
  const email = String(input.email ?? '')
    .trim()
    .toLowerCase();

  if (!email) {
    throw new Error('Email is required to create an invite.');
  }

  const organizationId =
    input.role === 'SUPER_ADMIN' ? undefined : input.organizationId;
  const venueId = input.role === 'SUPER_ADMIN' ? undefined : input.venueId;

  if (input.role === 'SUPER_ADMIN' && (input.organizationId || input.venueId)) {
    throw new Error(
      'SUPER_ADMIN invites cannot include organization or venue scope.'
    );
  }

  if (input.role !== 'SUPER_ADMIN' && !organizationId) {
    throw new Error('organizationId is required for scoped invites.');
  }

  if (venueId) {
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { organizationId: true, isActive: true }
    });

    if (!venue || !venue.isActive) {
      throw new Error('Invite venue does not exist or is inactive.');
    }

    if (organizationId && venue.organizationId !== organizationId) {
      throw new Error('Invite venue must belong to invite organization.');
    }
  }

  const rawToken = randomBytes(24).toString('hex');
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(
    Date.now() + env.AUTH_INVITE_TTL_HOURS * 60 * 60 * 1000
  );

  await prisma.authInvite.create({
    data: {
      email,
      role: input.role,
      invitedByUserId: input.invitedByUserId,
      organizationId,
      venueId,
      tokenHash,
      expiresAt
    }
  });

  return {
    inviteUrl: `${env.APP_URL}/login?inviteToken=${rawToken}`,
    expiresAt
  };
}

export async function acceptInvite(input: {
  token: string;
  password: string;
  firstName?: string;
  lastName?: string;
}) {
  const tokenHash = hashInviteToken(input.token);

  const invite = await prisma.authInvite.findUnique({
    where: { tokenHash }
  });

  if (!invite || invite.acceptedAt || invite.expiresAt <= new Date()) {
    throw new Error('Invite is invalid or expired.');
  }

  const passwordHash = await hashPassword(input.password);

  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
    select: { id: true, organizationId: true }
  });

  if (
    existingUser?.organizationId &&
    invite.organizationId &&
    existingUser.organizationId !== invite.organizationId
  ) {
    throw new Error(
      'Invite organization does not match existing user organization.'
    );
  }

  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          isActive: true,
          organizationId:
            existingUser.organizationId ?? invite.organizationId ?? undefined
        }
      })
    : await prisma.user.create({
        data: {
          email: invite.email,
          firstName: input.firstName,
          lastName: input.lastName,
          passwordHash,
          organizationId: invite.organizationId ?? undefined
        }
      });

  const scopeKey = `${user.id}:${invite.role}:${invite.organizationId ?? 'global'}:${invite.venueId ?? 'global'}`;

  await prisma.adminRoleAssignment.upsert({
    where: { scopeKey },
    update: { isActive: true },
    create: {
      userId: user.id,
      role: invite.role,
      organizationId: invite.organizationId,
      venueId: invite.venueId,
      scopeKey,
      isActive: true
    }
  });

  await prisma.authInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() }
  });

  return user;
}
