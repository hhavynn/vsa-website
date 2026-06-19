import { createContext, useContext, useState } from 'react';
import { disableGA, isAnalyticsConfigured } from '../lib/analytics';

type AnalyticsConsent = 'granted' | 'declined' | null;

interface AnalyticsConsentContextValue {
  consent: AnalyticsConsent;
  isConfigured: boolean;
  preferencesOpen: boolean;
  allowAnalytics: () => void;
  declineAnalytics: () => void;
  openPreferences: () => void;
  closePreferences: () => void;
}

const STORAGE_KEY = 'vsa-analytics-consent-v1';
const AnalyticsConsentContext = createContext<AnalyticsConsentContextValue | undefined>(undefined);

function readStoredConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'granted' || stored === 'declined' ? stored : null;
  } catch {
    return null;
  }
}

export function AnalyticsConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<AnalyticsConsent>(readStoredConsent);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const isConfigured = isAnalyticsConfigured();

  const saveConsent = (nextConsent: Exclude<AnalyticsConsent, null>) => {
    setConsent(nextConsent);
    setPreferencesOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextConsent);
    } catch {
      // The in-memory choice still applies for this visit when storage is unavailable.
    }
  };

  const allowAnalytics = () => saveConsent('granted');
  const declineAnalytics = () => {
    disableGA();
    saveConsent('declined');
  };

  return (
    <AnalyticsConsentContext.Provider
      value={{
        consent,
        isConfigured,
        preferencesOpen,
        allowAnalytics,
        declineAnalytics,
        openPreferences: () => setPreferencesOpen(true),
        closePreferences: () => setPreferencesOpen(false),
      }}
    >
      {children}
    </AnalyticsConsentContext.Provider>
  );
}

export function useAnalyticsConsent() {
  const context = useContext(AnalyticsConsentContext);
  if (!context) {
    throw new Error('useAnalyticsConsent must be used within an AnalyticsConsentProvider');
  }
  return context;
}
