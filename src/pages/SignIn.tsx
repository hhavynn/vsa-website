import { motion } from 'framer-motion';
import { SignInForm } from '../components/features/auth/SignInForm';

export function SignIn() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 hero-gradient" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(99,102,241,0.3),transparent)]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-heading font-extrabold text-3xl text-white mb-2">
            Welcome to VSA
          </h1>
          <p className="text-slate-400 text-sm">Sign in to access member features</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-700/60 backdrop-blur-sm p-8 shadow-card">
          <SignInForm />

          <div className="mt-6 pt-6 border-t border-slate-800/60">
            <p className="text-slate-400 text-xs text-center leading-relaxed">
              VSA membership is by invitation only. If you're interested in becoming a member,
              connect with our cabinet at one of our events!
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </motion.div>
    </div>
  );
}
