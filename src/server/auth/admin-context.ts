import { prisma } from '@/server/db/prisma/client';
import { requireRole } from './authorization';

type AdminAssignment = {
  role: string;
  organizationId: string | null;
  venueId: string | null;
};

function getAllowedVenueIdsForOrganization(
  assignments: AdminAssignment[],
  organizationId: string
) {
  const orgAssignments = assignments.filter(
    (assignment) => assignment.organizationId === organizationId
  );

  const hasOrganizationWideScope = orgAssignments.some(
    (assignment) => !assignment.venueId
  );

  if (hasOrganizationWideScope) {
    return null;
  }

  return orgAssignments
    .map((assignment) => assignment.venueId)
    .filter((venueId): venueId is string => Boolean(venueId));
}

async function resolveSingleActiveVenue(
  organizationId: string,
  allowedVenueIds: string[] | null
) {
  const venues = await prisma.venue.findMany({
    where: {
      organizationId,
      isActive: true,
      ...(allowedVenueIds
        ? {
            id: {
              in: allowedVenueIds
            }
          }
        : {})
    },
    select: { id: true }
  });

  if (venues.length === 0) {
    throw new Error(
      `Admin context resolution failed: no active venue available for organizationId "${organizationId}" within user scope.`
    );
  }

  if (venues.length > 1) {
    throw new Error(
      `Admin context resolution failed: multiple active venues are available for organizationId "${organizationId}". Explicit venue selection is required.`
    );
  }

  return venues[0].id;
}

export async function getAdminContext() {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER',
    'HOST'
  ]);

  const roles = user.adminRoles as AdminAssignment[];

  const scopedAssignments = roles.filter(
    (assignment) => Boolean(assignment.organizationId)
  );

  if (scopedAssignments.length === 0) {
    const isSuperAdmin = roles.some((assignment) => assignment.role === 'SUPER_ADMIN');

    if (!isSuperAdmin) {
      throw new Error(
        'Admin context resolution failed: no organization scope found for current user.'
      );
    }

    const organizations = await prisma.organization.findMany({
      where: { isActive: true },
      select: { id: true }
    });

    if (organizations.length === 0) {
      throw new Error(
        'Admin context resolution failed: no active organizations are available.'
      );
    }

    if (organizations.length > 1) {
      throw new Error(
        'Admin context resolution failed: multiple active organizations are available. Explicit organization selection is required.'
      );
    }

    const organizationId = organizations[0].id;
    const venueId = await resolveSingleActiveVenue(organizationId, null);

    return {
      user,
      organizationId,
      venueId
    };
  }

  const explicitVenueAssignments = scopedAssignments.filter((assignment) =>
    Boolean(assignment.venueId)
  );

  if (explicitVenueAssignments.length > 1) {
    throw new Error(
      'Admin context resolution failed: multiple scoped venues available. Explicit venue selection is required.'
    );
  }

  if (explicitVenueAssignments.length === 1) {
    const assignment = explicitVenueAssignments[0];
    const organizationId = assignment.organizationId;
    const venueId = assignment.venueId;

    if (!organizationId || !venueId) {
      throw new Error(
        'Admin context resolution failed: invalid scoped assignment is missing organizationId or venueId.'
      );
    }

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { organizationId: true, isActive: true }
    });

    if (!venue || !venue.isActive) {
      throw new Error(
        `Admin context resolution failed: no active venue available for scoped venueId "${venueId}".`
      );
    }

    if (venue.organizationId !== organizationId) {
      throw new Error(
        `Admin context resolution failed: invalid org/venue relationship. venueId "${venueId}" does not belong to organizationId "${organizationId}".`
      );
    }

    return {
      user,
      venueId,
      organizationId
    };
  }

  const organizationIds = Array.from(
    new Set(
      scopedAssignments
        .map((assignment) => assignment.organizationId)
        .filter((organizationId): organizationId is string => Boolean(organizationId))
    )
  );

  if (organizationIds.length !== 1) {
    throw new Error(
      'Admin context resolution failed: no organization scope could be selected automatically. Explicit organization selection is required.'
    );
  }

  const organizationId = organizationIds[0];
  const allowedVenueIds = getAllowedVenueIdsForOrganization(
    scopedAssignments,
    organizationId
  );
  const venueId = await resolveSingleActiveVenue(organizationId, allowedVenueIds);

  return {
    user,
    venueId,
    organizationId
  };
}

