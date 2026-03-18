import { useState } from 'react';
import { supabase } from '../../../lib/supabase';

const inputCls = 'mt-1 block w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 px-3 py-2 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500';
const labelCls = 'block text-xs font-medium text-zinc-500 uppercase tracking-widest mb-1';

export function SignUpForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            first_name: firstName,
            last_name: lastName
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!user) throw new Error('No user returned from sign up');

      setSuccess('Sign up successful! Please check your email to confirm your account.');
    } catch (err) {
      console.error('Error in sign up process:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="firstName" className={labelCls}>First Name</label>
        <input
          type="text"
          id="firstName"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className={inputCls}
          required
        />
      </div>

      <div>
        <label htmlFor="lastName" className={labelCls}>Last Name</label>
        <input
          type="text"
          id="lastName"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className={inputCls}
          required
        />
      </div>

      <div>
        <label htmlFor="email" className={labelCls}>Email</label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
          required
        />
      </div>

      <div>
        <label htmlFor="password" className={labelCls}>Password</label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
          required
        />
      </div>

      {success && (
        <div className="p-3 rounded border border-emerald-500/30 bg-emerald-950/20 text-emerald-400 text-sm">
          {success}
        </div>
      )}

      {error && (
        <div className="p-3 rounded border border-red-900/40 bg-red-950/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2.5 px-4 rounded text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 transition-colors duration-150 disabled:opacity-50"
      >
        {loading ? 'Signing up...' : 'Sign Up'}
      </button>
    </form>
  );
}
