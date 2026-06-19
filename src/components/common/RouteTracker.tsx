import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initGA, trackPageView } from '../../lib/analytics';
import { useAnalyticsConsent } from '../../context/AnalyticsConsentContext';

/**
 * Component that monitors route changes and reports them as GA4 page_view events.
 * Should be placed inside the main Router component.
 */
const RouteTracker = () => {
  const location = useLocation();
  const { consent } = useAnalyticsConsent();

  useEffect(() => {
    if (consent !== 'granted') return;
    initGA();
    trackPageView(location.pathname);
  }, [consent, location.pathname]);

  return null;
};

export default RouteTracker;
