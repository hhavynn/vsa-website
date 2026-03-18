import { motion } from 'framer-motion';
import { SignInForm } from '../components/features/auth/SignInForm';

export function SignIn() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-white dark:bg-zinc-950">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-bold text-2xl text-zinc-900 dark:text-zinc-50 tracking-tight mb-2">
            Welcome to VSA
          </h1>
          <p className="text-zinc-500 text-sm">Sign in to access member features</p>
        </div>

        {/* Card */}
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] rounded-md p-8">
          <SignInForm />

          <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <p className="text-zinc-500 text-xs text-center leading-relaxed">
              VSA membership is by invitation only. If you're interested in becoming a member,
              connect with our cabinet at one of our events!
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </motion.div>
    </div>
  );
}
