import {
  AuthShell,
  AuthNotice,
  AuthLink,
  fieldInput,
  fieldLabel,
  primaryButton
} from '@/components/auth/auth-ui';

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    inviteToken?: string;
  }>;
};

function errorMessage(error?: string) {
  if (!error) {
    return null;
  }

  switch (error) {
    case 'invalid_credentials':
      return 'Invalid email or password.';
    case 'forbidden':
      return 'You are signed in but do not have access to that admin area.';
    case 'invalid_invite':
      return 'That invite token is invalid or expired.';
    case 'too_many_requests':
      return 'Too many attempts. Try again in 15 minutes.';
    default:
      return 'Unable to complete sign in.';
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const inviteToken = resolvedSearchParams?.inviteToken;
  const error = errorMessage(resolvedSearchParams?.error);

  return (
    <AuthShell
      eyebrow={inviteToken ? 'Accept invite' : 'Admin access'}
      title={inviteToken ? 'Set up your account' : 'Sign in'}
      description={
        inviteToken
          ? 'Set a password to activate your invite and join the team.'
          : 'Invite-only access for hosts, managers, and admins.'
      }
      footer={
        <>
          <p>
            Need an invite? Ask your organization admin, then return using the
            invite URL.
          </p>
          <p>
            New customer?{' '}
            <AuthLink href="/signup">Start a free 14-day trial</AuthLink>
          </p>
          <p>
            Back to <AuthLink href="/">home</AuthLink>
          </p>
        </>
      }
    >
      {error ? <AuthNotice>{error}</AuthNotice> : null}

      {inviteToken ? (
        <form
          action="/api/auth/invite/accept"
          method="post"
          className="mt-6 space-y-4"
        >
          <input type="hidden" name="token" value={inviteToken} />
          <label className={fieldLabel}>
            First name
            <input
              required
              name="firstName"
              placeholder="First name"
              className={fieldInput}
            />
          </label>
          <label className={fieldLabel}>
            Last name
            <input
              required
              name="lastName"
              placeholder="Last name"
              className={fieldInput}
            />
          </label>
          <label className={fieldLabel}>
            Password
            <input
              name="password"
              type="password"
              minLength={12}
              required
              placeholder="Create password (12+ chars)"
              className={fieldInput}
            />
          </label>
          <button className={primaryButton} type="submit">
            Accept invite
          </button>
        </form>
      ) : (
        <form action="/api/auth/login" method="post" className="mt-6 space-y-4">
          <label className={fieldLabel}>
            Work email
            <input
              name="email"
              type="email"
              required
              placeholder="work-email@company.com"
              className={fieldInput}
            />
          </label>
          <label className={fieldLabel}>
            Password
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Password"
              className={fieldInput}
            />
          </label>
          <button className={primaryButton} type="submit">
            Sign in
          </button>
          <p className="text-xs text-muted-foreground">
            <AuthLink href="/forgot-password">Forgot password?</AuthLink>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
