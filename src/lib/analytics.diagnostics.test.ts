describe('consent-gated, redacted GA4 diagnostics (#302)', () => {
  const oldMeasurementId = process.env.REACT_APP_GA4_MEASUREMENT_ID;
  const originalGtag = window.gtag;

  function loadAnalytics(): typeof import('./analytics') {
    jest.resetModules();
    return require('./analytics') as typeof import('./analytics');
  }

  beforeEach(() => {
    process.env.REACT_APP_GA4_MEASUREMENT_ID = 'G-SYNTHETIC';
    window.gtag = jest.fn();
  });

  afterEach(() => {
    if (oldMeasurementId === undefined) delete process.env.REACT_APP_GA4_MEASUREMENT_ID;
    else process.env.REACT_APP_GA4_MEASUREMENT_ID = oldMeasurementId;
    window.gtag = originalGtag;
    jest.restoreAllMocks();
  });

  it('does not send any diagnostics without explicit consent', () => {
    const a = loadAnalytics();
    a.trackSafeDiagnosticError('render_failure');
    a.trackSafeWebVital({ name: 'LCP', value: 1575 });
    expect(window.gtag).not.toHaveBeenCalled();
  });

  it('reports only a generic exception category and coarse page area', () => {
    const a = loadAnalytics();
    a.setDiagnosticsConsent(true);
    const previous = window.location.pathname + window.location.search;
    window.history.replaceState({}, '', '/points?name=private-student-name');
    a.trackSafeDiagnosticError('render_failure');
    expect(window.gtag).toHaveBeenCalledWith('event', 'exception', {
      description: 'render_failure',
      page_area: 'public',
      page_path: '/',
      page_location: window.location.origin + '/',
      page_referrer: window.location.origin + '/',
      fatal: true,
      send_to: 'G-SYNTHETIC',
    });
    expect(JSON.stringify((window.gtag as jest.Mock).mock.calls)).not.toContain('private-student-name');
    expect(JSON.stringify((window.gtag as jest.Mock).mock.calls)).not.toContain('/points');
    window.history.replaceState({}, '', previous);
  });

  it('accepts known web-vitals names and ignores invalid or untrusted metrics', () => {
    const a = loadAnalytics();
    a.setDiagnosticsConsent(true);
    a.trackSafeWebVital({ name: 'LCP', value: 1304.1567 });
    a.trackSafeWebVital({ name: 'query=secret', value: 10 });
    a.trackSafeWebVital({ name: 'CLS', value: Number.NaN });
    a.trackSafeWebVital({ name: 'TTFB', value: -1 });
    expect(window.gtag).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith('event', 'web_vital', {
      metric_name: 'LCP',
      metric_value: 1304.157,
      page_area: 'public',
      page_path: '/',
      page_location: window.location.origin + '/',
      page_referrer: window.location.origin + '/',
      send_to: 'G-SYNTHETIC',
    });
  });

  it('stops sending immediately when consent is withdrawn', () => {
    const a = loadAnalytics();
    a.setDiagnosticsConsent(true);
    a.disableGA();
    a.trackSafeWebVital({ name: 'INP', value: 33 });
    a.trackSafeDiagnosticError('chunk_load');
    expect(window.gtag).not.toHaveBeenCalled();
  });
});

// Mark this Jest test as a TypeScript module for isolatedModules/CRA builds.
export {};
