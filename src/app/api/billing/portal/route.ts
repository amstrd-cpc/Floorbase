import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/authorization';
import { getAdminContext } from '@/server/auth/admin-context';
import { createPortalSession } from '@/server/billing/service';
import { env } from '@/env';

export async function POST() {
  await requireRole(['ORGANIZATION_ADMIN']);
  const { organizationId } = await getAdminContext();

  const returnUrl = `${env.APP_URL}/admin/billing`;

  try {
    const portalUrl = await createPortalSession(organizationId, returnUrl);
    return NextResponse.redirect(portalUrl, { status: 303 });
  } catch (error) {
    console.error('Portal session error', error);
    const msg = error instanceof Error ? error.message : 'Failed to create billing portal session.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
