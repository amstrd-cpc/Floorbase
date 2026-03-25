import { redirect } from 'next/navigation';
import { getCurrentSession } from './session';

type RoleScope = {
  organizationId?: string;
  venueId?: string;
};

function roleMatchesScope(
  assignment: { organizationId: string | null; venueId: string | null },
  scope?: RoleScope
) {
  if (!scope) {
    return true;
  }

  const organizationMatches = !scope.organizationId || assignment.organizationId === scope.organizationId;
  const venueMatches = !scope.venueId || assignment.venueId === scope.venueId;

  return organizationMatches && venueMatches;
}

export async function requireAuthenticatedUser() {
  const session = await getCurrentSession();

  if (!session) {
    redirect('/login');
  }

  return session.user;
}

export async function requireRole(
  requiredRoles: ReadonlyArray<'SUPER_ADMIN' | 'ORGANIZATION_ADMIN' | 'VENUE_MANAGER' | 'HOST'>,
  scope?: RoleScope
) {
  const user = await requireAuthenticatedUser();

  const isAllowed = user.adminRoles.some((assignment) => {
    if (!requiredRoles.includes(assignment.role)) {
      return false;
    }

    if (assignment.role === 'SUPER_ADMIN') {
      return true;
    }

    return roleMatchesScope(assignment, scope);
  });

  if (!isAllowed) {
    redirect('/login?error=forbidden');
  }

  return user;
}
