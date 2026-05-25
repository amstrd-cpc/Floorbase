import { PageHeader } from '@/components/admin/page-header';
import { SectionCard } from '@/components/admin/section-card';
import { TeamInviteForm } from '@/components/admin/team-invite-form';
import { RevokeUserButton } from '@/components/admin/revoke-user-button';
import { getAdminContext } from '@/server/auth/admin-context';
import { prisma } from '@/server/db/prisma/client';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ORGANIZATION_ADMIN: 'Org Admin',
  VENUE_MANAGER: 'Venue Manager',
  HOST: 'Host',
};

export default async function TeamSettingsPage() {
  const { organizationId, venueId, user: currentUser } = await getAdminContext();
  if (!organizationId || !venueId) return <p>Missing admin scope.</p>;

  const [users, pendingInvites] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        lastLoginAt: true,
        adminRoles: {
          where: { organizationId, isActive: true },
          select: { role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.authInvite.findMany({
      where: {
        organizationId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, email: true, role: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Team"
        description="Manage who has access to this organization."
      />

      <SectionCard title="Active members">
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active members.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4 text-left">Name / Email</th>
                  <th className="py-2 pr-4 text-left">Roles</th>
                  <th className="py-2 pr-4 text-left">Last login</th>
                  <th className="py-2 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || null;
                  const roles = u.adminRoles.map((r) => ROLE_LABELS[r.role] ?? r.role).join(', ');
                  const isMe = u.id === currentUser.id;
                  return (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        {name && <div className="font-medium">{name}</div>}
                        <div className="text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{roles || '—'}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {u.lastLoginAt
                          ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(u.lastLoginAt)
                          : 'Never'}
                      </td>
                      <td className="py-2">
                        {isMe ? (
                          <span className="text-xs text-muted-foreground">You</span>
                        ) : (
                          <RevokeUserButton userId={u.id} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {pendingInvites.length > 0 && (
        <SectionCard title="Pending invites">
          <div className="space-y-1 text-sm">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-4 border-b py-2 last:border-0">
                <div>
                  <span className="font-medium">{invite.email}</span>
                  <span className="ml-2 text-muted-foreground">
                    {ROLE_LABELS[invite.role] ?? invite.role}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Expires {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(invite.expiresAt)}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title="Invite a team member">
        <TeamInviteForm organizationId={organizationId} venueId={venueId} />
      </SectionCard>
    </div>
  );
}
