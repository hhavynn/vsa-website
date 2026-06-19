import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAnalyticsConsent } from '../../context/AnalyticsConsentContext';
import { Button } from '../ui/Button';

export function AnalyticsConsentBanner() {
  const {
    consent,
    isConfigured,
    preferencesOpen,
    allowAnalytics,
    declineAnalytics,
    closePreferences,
  } = useAnalyticsConsent();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isVisible = isConfigured && (consent === null || preferencesOpen);

  useEffect(() => {
    if (preferencesOpen) headingRef.current?.focus();
  }, [preferencesOpen]);

  if (!isVisible) return null;

  return (
    <section
      aria-labelledby="analytics-consent-title"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-2xl rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4 shadow-2xl sm:bottom-5 sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="analytics-consent-title"
            ref={headingRef}
            tabIndex={preferencesOpen ? -1 : undefined}
            className="font-sans text-base font-bold text-[var(--color-text)] outline-none"
          >
            Analytics choice
          </h2>
          <p className="mt-2 font-sans text-sm leading-6 text-[var(--color-text2)]">
            VSA can use Google Analytics to understand page visits. It stays off unless you allow it.
            Functional browser storage for features such as theme and sign-in is separate.{' '}
            <Link to="/privacy" className="font-semibold text-brand-600 underline underline-offset-2 dark:text-brand-400">
              Read the privacy notice
            </Link>
            .
          </p>
        </div>
        {consent !== null && (
          <button
            type="button"
            onClick={closePreferences}
            aria-label="Close analytics preferences"
            className="rounded-md px-2 py-1 text-xl leading-none text-[var(--color-text2)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            ×
          </button>
        )}
      </div>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={declineAnalytics}>
          Decline analytics
        </Button>
        <Button type="button" onClick={allowAnalytics}>
          Allow analytics
        </Button>
      </div>
    </section>
  );
}
