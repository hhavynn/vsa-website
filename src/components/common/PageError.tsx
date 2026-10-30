import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface PageErrorProps {
  error?: Error;
  resetError?: () => void;
  title?: string;
  message?: string;
  showRetry?: boolean;
}

export function PageError({
  error,
  resetError,
  title = "Something went wrong",
  message = "We encountered an unexpected error. Please try again.",
  showRetry = true
}: PageErrorProps) {
  const shouldReduceMotion = useReducedMotion();
  const handleRetry = () => {
    if (resetError) {
      resetError();
    } else {
      window.location.reload();
    }
  };

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-[400px] flex items-center justify-center p-8"
    >
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg border border-red-200 bg-red-50 dark:border-red-400/30 dark:bg-red-400/10">
            <svg
              className="h-8 w-8 text-red-700 dark:text-red-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>

          <h2 className="mb-2 font-display text-[1.9rem] font-normal leading-tight text-text-primary">
            {title}
          </h2>

          <p className="mb-6 font-sans text-sm leading-relaxed text-text-secondary">
            {message}
          </p>

          {process.env.NODE_ENV === 'development' && error && (
            <details className="mb-6 text-left">
              <summary className="mb-2 cursor-pointer text-sm font-medium text-text-muted">
                Error Details (Development)
              </summary>
              <pre className="overflow-auto rounded border border-[var(--color-border)] bg-surface2 p-3 text-xs text-text-primary">
                {error.stack || error.message}
              </pre>
            </details>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {showRetry && (
            <button
              onClick={handleRetry}
              className="rounded bg-brand-600 px-6 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 dark:bg-brand-300 dark:text-brand-950 dark:hover:bg-brand-200"
            >
              Try Again
            </button>
          )}

          <button
            onClick={() => window.history.back()}
            className="rounded border border-[var(--color-border)] px-6 py-2 text-sm font-medium text-text-secondary transition-colors duration-150 hover:bg-surface2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
          >
            Go Back
          </button>
        </div>
      </div>
    </motion.div>
  );
}
