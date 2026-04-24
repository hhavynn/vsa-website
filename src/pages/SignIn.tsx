import { SignInForm } from '../components/features/auth/SignInForm';
import { PageTitle } from '../components/common/PageTitle';

export function SignIn() {
  return (
    <>
      <PageTitle title="Sign In" />
      <div className="min-h-screen flex items-center justify-center px-4 py-16" style={{ background: 'var(--color-bg)' }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="font-serif leading-none tracking-[-0.03em] mb-2" style={{ fontSize: 36, color: 'var(--color-text)' }}>
              Welcome to VSA
            </h1>
            <p className="font-sans text-sm" style={{ color: 'var(--color-text2)' }}>Sign in to access member features</p>
          </div>

          <div className="border rounded" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', padding: '32px' }}>
            <SignInForm />
          </div>

          <p className="mt-6 text-center font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </>
  );
}
