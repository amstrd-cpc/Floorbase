import { createHash, randomBytes } from 'crypto';
import { AdminRole } from '@prisma/client';
import { env } from '@/env';
import { prisma } from '@/server/db/prisma/client';
import { hashPassword } from './password';

function hashInviteToken(rawToken: string) {
  return createHash('sha256').update(`${rawToken}.${env.AUTH_SESSION_SECRET}`).digest('hex');
}

export async function createInvite(input: {
  email: string;
  role: AdminRole;
  invitedByUserId?: string;
  organizationId?: string;
  venueId?: string;
}) {
  const email = String(input.email ?? '').trim().toLowerCase();

  if (!email) {
    throw new Error('Email is required to create an invite.');
  }

  const organizationId = input.role === 'SUPER_ADMIN' ? undefined : input.organizationId;
  const venueId = input.role === 'SUPER_ADMIN' ? undefined : input.venueId;

  const rawToken = randomBytes(24).toString('hex');
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + env.AUTH_INVITE_TTL_HOURS * 60 * 60 * 1000);

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

export async function acceptInvite(input: { token: string; password: string; firstName?: string; lastName?: string }) {
  const tokenHash = hashInviteToken(input.token);

  const invite = await prisma.authInvite.findUnique({
    where: { tokenHash }
  });

  if (!invite || invite.acceptedAt || invite.expiresAt <= new Date()) {
    throw new Error('Invite is invalid or expired.');
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.upsert({
    where: { email: invite.email },
    update: {
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      isActive: true,
      organizationId: invite.organizationId ?? undefined
    },
    create: {
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
