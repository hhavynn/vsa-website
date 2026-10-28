import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initGA, isAnalyticsConfigured, setDiagnosticsConsent, trackPageView, trackSafeWebVital } from '../../lib/analytics';
import reportWebVitals from '../../reportWebVitals';
import { trackProductPageView } from '../../lib/productAnalytics';
import { useAnalyticsConsent } from '../../context/AnalyticsConsentContext';

// Register once per tab; consent withdrawal stops dispatch in analytics.ts.
let vitalsStarted = false;

/**
 * Component that monitors route changes and reports them as GA4 page_view and
 * PostHog $pageview events, only after analytics consent.
 * Should be placed inside the main Router component.
 */
const RouteTracker = () => {
  const location = useLocation();
  const { consent } = useAnalyticsConsent();

  useEffect(() => {
    const granted = consent === 'granted';
    setDiagnosticsConsent(granted);
    if (!granted) return;
    initGA();
    trackPageView(location.pathname);
    trackProductPageView(location.pathname);
    if (!vitalsStarted && isAnalyticsConfigured()) {
      vitalsStarted = true;
      reportWebVitals(trackSafeWebVital);
    }
  }, [consent, location.pathname]);

  return null;
};

export default RouteTracker;
