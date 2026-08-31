type BillingBannerProps = {
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
  trialEndsAt: Date | null;
};

export function BillingBanner({ status, trialEndsAt }: BillingBannerProps) {
  if (status === 'ACTIVE') return null;

  let message = '';
  let style = '';

  if (status === 'TRIALING' && trialEndsAt) {
    // Server Component: re-rendered fresh per request, not memoized, so
    // reading the wall clock here is safe despite the react-hooks/purity rule.
    const daysLeft = Math.ceil(
      // eslint-disable-next-line react-hooks/purity
      (trialEndsAt.getTime() - Date.now()) / 86_400_000
    );
    if (daysLeft > 3) return null;
    message =
      daysLeft <= 0
        ? 'Your trial has expired. Subscribe to keep access.'
        : `Trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Subscribe to keep access.`;
    style =
      daysLeft <= 1
        ? 'border-foreground bg-secondary text-foreground'
        : 'border-border bg-secondary text-foreground';
  }

  if (status === 'PAST_DUE') {
    message =
      'Payment failed. Update your payment method to restore full access.';
    style = 'border-foreground bg-secondary text-foreground';
  }

  if (!message) return null;

  return (
    <div className={`border-b px-4 py-2 text-sm ${style}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <span>{message}</span>
        <a
          href="/admin/billing"
          className="whitespace-nowrap font-medium underline"
        >
          Manage billing →
        </a>
      </div>
    </div>
  );
}
