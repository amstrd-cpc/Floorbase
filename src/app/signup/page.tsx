import { AuthShell, AuthNotice, AuthLink, fieldInput, fieldLabel, primaryButton } from '@/components/auth/auth-ui';

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
    <AuthShell
      eyebrow="New account"
      title="Start your free trial"
      description="14 days, no credit card required. Full access to every feature."
      footer={
        <p>
          Already have an account? <AuthLink href="/login">Sign in</AuthLink>
        </p>
      }
    >
      {error ? <AuthNotice>{error}</AuthNotice> : null}

      <form action="/api/auth/signup" method="post" className="mt-6 space-y-4">
        <label className={fieldLabel}>
          Work email
          <input
            name="email"
            type="email"
            required
            placeholder="you@yourrestaurant.com"
            className={fieldInput}
          />
        </label>

        <label className={fieldLabel}>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={12}
            placeholder="12+ characters, include a number"
            className={fieldInput}
          />
        </label>

        <label className={fieldLabel}>
          Organization name
          <input
            name="orgName"
            required
            placeholder="e.g. Northfork Hospitality Group"
            className={fieldInput}
          />
        </label>

        <label className={fieldLabel}>
          First venue name
          <input
            name="venueName"
            required
            placeholder="e.g. Harbor House"
            className={fieldInput}
          />
        </label>

        <label className={fieldLabel}>
          Venue timezone
          <select
            name="timezone"
            required
            defaultValue="America/New_York"
            className={fieldInput}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </label>

        <button type="submit" className={primaryButton}>
          Create account
        </button>
      </form>
    </AuthShell>
  );
}
