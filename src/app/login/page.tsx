import Link from 'next/link';

type LoginPageProps = {
  searchParams?: {
    error?: string;
    inviteToken?: string;
  };
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
    default:
      return 'Unable to complete sign in.';
  }
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const inviteToken = searchParams?.inviteToken;
  const error = errorMessage(searchParams?.error);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center p-6">
      <section className="w-full rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Internal Admin Login</h1>
        <p className="mt-2 text-sm text-muted-foreground">Invite-only access. Public signup is disabled.</p>

        {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        {inviteToken ? (
          <form action="/api/auth/invite/accept" method="post" className="mt-6 space-y-3">
            <input type="hidden" name="token" value={inviteToken} />
            <h2 className="text-sm font-medium">Accept invite and set password</h2>
            <input name="firstName" placeholder="First name" className="w-full rounded border p-2 text-sm" />
            <input name="lastName" placeholder="Last name" className="w-full rounded border p-2 text-sm" />
            <input
              name="password"
              type="password"
              minLength={8}
              required
              placeholder="Create password"
              className="w-full rounded border p-2 text-sm"
            />
            <button className="rounded bg-black px-4 py-2 text-sm text-white" type="submit">
              Accept Invite
            </button>
          </form>
        ) : (
          <form action="/api/auth/login" method="post" className="mt-6 space-y-3">
            <input
              name="email"
              type="email"
              required
              placeholder="work-email@company.com"
              className="w-full rounded border p-2 text-sm"
            />
            <input
              name="password"
              type="password"
              required
              placeholder="Password"
              className="w-full rounded border p-2 text-sm"
            />
            <button className="rounded bg-black px-4 py-2 text-sm text-white" type="submit">
              Sign in
            </button>
          </form>
        )}

        <p className="mt-5 text-xs text-muted-foreground">
          Need an invite? Ask your organization admin. Then return to this screen using the invite URL.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Back to <Link href="/">home</Link>.
        </p>
      </section>
    </main>
  );
}
