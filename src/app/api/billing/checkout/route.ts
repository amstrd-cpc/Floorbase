import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/authorization';
import { getAdminContext } from '@/server/auth/admin-context';
import { createCheckoutSession } from '@/server/billing/service';
import { env } from '@/env';

export async function POST() {
  await requireRole(['ORGANIZATION_ADMIN']);
  const { organizationId } = await getAdminContext();

  const successUrl = `${env.APP_URL}/admin/billing?success=1`;
  const cancelUrl = `${env.APP_URL}/admin/billing`;

  try {
    const checkoutUrl = await createCheckoutSession(organizationId, {
      successUrl,
      cancelUrl,
    });
    return NextResponse.redirect(checkoutUrl, { status: 303 });
  } catch (error) {
    console.error('Checkout session error', error);
    const msg = error instanceof Error ? error.message : 'Failed to create checkout session.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
