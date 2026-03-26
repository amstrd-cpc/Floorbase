import { AdminRole } from '@prisma/client';

export const ADMIN_ROLE_VALUES = [
  AdminRole.SUPER_ADMIN,
  AdminRole.ORGANIZATION_ADMIN,
  AdminRole.VENUE_MANAGER,
  AdminRole.HOST
] as const;

export function isAdminRole(value: string): value is AdminRole {
  return ADMIN_ROLE_VALUES.includes(value as AdminRole);
}

export const ROLE_PRIORITY: ReadonlyArray<AdminRole> = [
  AdminRole.HOST,
  AdminRole.VENUE_MANAGER,
  AdminRole.ORGANIZATION_ADMIN,
  AdminRole.SUPER_ADMIN
];
