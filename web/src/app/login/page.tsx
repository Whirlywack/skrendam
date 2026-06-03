import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function login(formData: FormData) {
    'use server';
    try {
      await signIn('credentials', {
        username: formData.get('username'),
        password: formData.get('password'),
        redirectTo: '/',
      });
    } catch (err) {
      // A failed Credentials sign-in throws AuthError (CredentialsSignin);
      // re-throw the NEXT_REDIRECT that a *successful* sign-in raises.
      if (err instanceof AuthError) {
        redirect('/login?error=1');
      }
      throw err;
    }
  }

  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <form
        action={login}
        style={{
          width: 320,
          padding: 28,
          display: 'grid',
          gap: 12,
          background: 'var(--bg-surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <span
          style={{
            fontSize: 32,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            color: 'var(--brand)',
            letterSpacing: '-0.03em',
          }}
        >
          yıp
        </span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '4px 0 8px' }}>
          Deal Desk
        </h1>
        {error ? (
          <p style={{ margin: 0, color: 'var(--coral-600)', fontSize: 13 }}>
            Invalid username or password.
          </p>
        ) : null}
        <input
          name="username"
          placeholder="Username"
          autoComplete="username"
          className="draftbox"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          className="draftbox"
        />
        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
