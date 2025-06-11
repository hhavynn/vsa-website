import { useAuth } from '../hooks/useAuth';
import { SignInForm } from './Auth/SignInForm';

export function Home() {
  const { user } = useAuth();

  if (user) {
    return (
      <div className="text-center">
        <h1 className="text-3xl font-bold">Welcome, {user.email}!</h1>
        <p className="mt-4">You are signed in.</p>
      </div>
    );
  }

  return <SignInForm />;
} 