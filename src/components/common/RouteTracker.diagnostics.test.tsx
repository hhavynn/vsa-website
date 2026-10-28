import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RouteTracker from './RouteTracker';
import { useAnalyticsConsent } from '../../context/AnalyticsConsentContext';
import { initGA, isAnalyticsConfigured, setDiagnosticsConsent, trackPageView } from '../../lib/analytics';
import reportWebVitals from '../../reportWebVitals';

jest.mock('../../context/AnalyticsConsentContext', () => ({ useAnalyticsConsent: jest.fn() }));
jest.mock('../../reportWebVitals', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../lib/analytics', () => ({
  initGA: jest.fn(),
  isAnalyticsConfigured: jest.fn(),
  setDiagnosticsConsent: jest.fn(),
  trackPageView: jest.fn(),
  trackSafeWebVital: jest.fn(),
}));

const consent = useAnalyticsConsent as jest.Mock;
const configured = isAnalyticsConfigured as jest.Mock;
const report = reportWebVitals as jest.Mock;

it('registers vitals only with consent and stops diagnostics after withdrawal (#302)', async () => {
  configured.mockReturnValue(true);
  consent.mockReturnValue({ consent: null });
  const view = render(<MemoryRouter><RouteTracker /></MemoryRouter>);
  expect(setDiagnosticsConsent).toHaveBeenCalledWith(false);
  expect(report).not.toHaveBeenCalled();
  expect(initGA).not.toHaveBeenCalled();

  consent.mockReturnValue({ consent: 'granted' });
  view.rerender(<MemoryRouter><RouteTracker /></MemoryRouter>);
  await waitFor(() => expect(initGA).toHaveBeenCalledTimes(1));
  expect(trackPageView).toHaveBeenCalledWith('/');
  expect(setDiagnosticsConsent).toHaveBeenCalledWith(true);
  expect(report).toHaveBeenCalledTimes(1);

  consent.mockReturnValue({ consent: 'declined' });
  view.rerender(<MemoryRouter><RouteTracker /></MemoryRouter>);
  await waitFor(() => expect(setDiagnosticsConsent).toHaveBeenLastCalledWith(false));
  expect(report).toHaveBeenCalledTimes(1);
});
