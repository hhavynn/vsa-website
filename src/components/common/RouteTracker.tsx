import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../../lib/analytics';

/**
 * Component that monitors route changes and reports them as GA4 page_view events.
 * Should be placed inside the main Router component.
 */
const RouteTracker = () => {
  const location = useLocation();

  useEffect(() => {
    // Track page view on route change
    trackPageView(location.pathname + location.search);
  }, [location]);

  return null;
};

export default RouteTracker;
