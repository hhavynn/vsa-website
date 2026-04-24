/**
 * Lightweight Google Analytics 4 (GA4) utility.
 * Manages script injection and event dispatching for SPA tracking.
 */

const GA_ID = process.env.REACT_APP_GA4_MEASUREMENT_ID;

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

  // Inject GA4 script tag
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  // Initialize dataLayer and gtag function
  window.dataLayer = window.dataLayer || [];
  window.gtag = function() {
    window.dataLayer.push(arguments);
  };

  window.gtag('js', new Date());
  window.gtag('config', GA_ID, {
    // Prevent duplicate pageviews on initial load since we track manually in RouteTracker
    send_page_view: false,
    // Ensure anonymized tracking or other defaults if needed
    anonymize_ip: true,
  });
};

/**
 * Manually tracks a page view.
 * @param path The URL path to track.
 */
export const trackPageView = (path: string) => {
  if (!GA_ID || !window.gtag) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    send_to: GA_ID,
  });
};
