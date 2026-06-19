/**
 * Lightweight Google Analytics 4 (GA4) utility.
 * Manages script injection and event dispatching for SPA tracking.
 */

const GA_ID = process.env.REACT_APP_GA4_MEASUREMENT_ID;
const GA_SCRIPT_ID = 'vsa-ga4-script';

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

/**
 * Initializes the GA4 script and configures basic settings.
 * Called once at application startup.
 */
export const initGA = () => {
  if (!GA_ID || typeof window === 'undefined') return;

  const disableKey = `ga-disable-${GA_ID}`;
  (window as unknown as Record<string, boolean>)[disableKey] = false;

  if (!window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, {
      send_page_view: false,
      anonymize_ip: true,
    });
  }

  if (!document.getElementById(GA_SCRIPT_ID)) {
    const script = document.createElement('script');
    script.id = GA_SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);
  }
};

export const isAnalyticsConfigured = () => Boolean(GA_ID);

export const disableGA = () => {
  if (!GA_ID || typeof window === 'undefined') return;
  const disableKey = `ga-disable-${GA_ID}`;
  (window as unknown as Record<string, boolean>)[disableKey] = true;
};

/**
 * Manually tracks a page view.
 * @param path The URL path to track.
 */
export const trackPageView = (path: string) => {
  if (!GA_ID || !window.gtag) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: `${window.location.origin}${path}`,
    send_to: GA_ID,
  });
};
