'use client';

type Props = {
  hasSubscription: boolean;
};

export function BillingActions({ hasSubscription }: Props) {
  return (
    <div className="flex gap-3">
      {hasSubscription ? (
        <form action="/api/billing/portal" method="post">
          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-sm text-white"
          >
            Manage billing
          </button>
        </form>
      ) : (
        <form action="/api/billing/checkout" method="post">
          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-sm text-white"
          >
            Subscribe now
          </button>
        </form>
      )}
    </div>
  );
}
