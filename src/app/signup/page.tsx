import Link from 'next/link';

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
  'America/Toronto', 'America/Vancouver', 'America/Sao_Paulo',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid',
  'Europe/Rome', 'Europe/Amsterdam', 'Europe/Warsaw', 'Europe/Stockholm',
  'Europe/Helsinki', 'Europe/Athens', 'Europe/Istanbul', 'Europe/Moscow',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore',
  'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane',
  'Pacific/Auckland', 'UTC',
];

type Props = { searchParams?: { error?: string } };

function errorMessage(error?: string) {
  switch (error) {
    case 'email_taken':       return 'An account with that email already exists.';
    case 'invalid_input':     return 'Please fill in all fields. Password must be 12+ characters with at least one letter and one number.';
    case 'too_many_requests': return 'Too many attempts. Try again in an hour.';
    case 'server_error':      return 'Something went wrong. Please try again.';
    default:                  return null;
  }
}

export default function SignupPage({ searchParams }: Props) {
  const error = errorMessage(searchParams?.error);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center p-6">
      <section className="w-full rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Start your free 14-day trial</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No credit card required. Full access to all features.
        </p>

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <form action="/api/auth/signup" method="post" className="mt-6 space-y-3">
          <label className="block text-sm">
            Work email
            <input
              name="email"
              type="email"
              required
              placeholder="you@yourrestaurant.com"
              className="mt-1 w-full rounded border p-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            Password
            <input
              name="password"
              type="password"
              required
              minLength={12}
              placeholder="12+ characters, include a number"
              className="mt-1 w-full rounded border p-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            Organization name
            <input
              name="orgName"
              required
              placeholder="e.g. Northfork Hospitality Group"
              className="mt-1 w-full rounded border p-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            First venue name
            <input
              name="venueName"
              required
              placeholder="e.g. Harbor House"
              className="mt-1 w-full rounded border p-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            Venue timezone
            <select
              name="timezone"
              required
              defaultValue="America/New_York"
              className="mt-1 w-full rounded border p-2 text-sm"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="w-full rounded bg-black px-4 py-2 text-sm text-white"
          >
            Create account
          </button>
        </form>

        <p className="mt-5 text-xs text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="underline">Sign in</Link>.
        </p>
      </section>
    </main>
  );
}
