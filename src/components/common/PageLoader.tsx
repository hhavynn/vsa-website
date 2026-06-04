import { motion } from 'framer-motion';

interface PageLoaderProps {
  message?: string;
  showSpinner?: boolean;
}

export function PageLoader({ message = 'Loading...', showSpinner = true }: PageLoaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex min-h-[60vh] items-center justify-center p-6 sm:p-8"
      role="status"
      aria-live="polite"
    >
      <div className="scrapbook-empty mx-auto flex w-full max-w-sm flex-col items-center justify-center gap-4 px-6 py-8 text-center">
        {showSpinner && (
          <div className="relative">
            <div className="h-10 w-10 rounded-full border-2" style={{ borderColor: 'var(--color-border)' }} />
            <div className="absolute inset-0 h-10 w-10 animate-spin rounded-full border-2 border-transparent border-t-brand-600" />
          </div>
        )}
        <p className="font-sans text-sm font-medium" style={{ color: 'var(--color-text2)' }}>{message}</p>
        <div className="flex gap-1.5" aria-hidden>
          {[0, 0.15, 0.3].map((delay, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay }}
              className="h-1.5 w-1.5 rounded-full bg-brand-600"
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
