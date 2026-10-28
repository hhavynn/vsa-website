import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AnalyticsConsentProvider, useAnalyticsConsent } from './AnalyticsConsentContext';
import { disableGA } from '../lib/analytics';
import { disableProductAnalytics } from '../lib/productAnalytics';

jest.mock('../lib/analytics', () => ({ disableGA: jest.fn(), isAnalyticsConfigured: () => false }));
jest.mock('../lib/productAnalytics', () => ({
  disableProductAnalytics: jest.fn(),
  isProductAnalyticsConfigured: () => true,
}));

const wrapper = ({ children }: { children: ReactNode }) => <AnalyticsConsentProvider>{children}</AnalyticsConsentProvider>;

describe('AnalyticsConsentProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it('counts as configured when only PostHog is configured', () => {
    const { result } = renderHook(() => useAnalyticsConsent(), { wrapper });
    expect(result.current.isConfigured).toBe(true);
  });

  it('declining turns off both GA4 and PostHog', () => {
    const { result } = renderHook(() => useAnalyticsConsent(), { wrapper });
    act(() => result.current.declineAnalytics());
    expect(disableGA).toHaveBeenCalledTimes(1);
    expect(disableProductAnalytics).toHaveBeenCalledTimes(1);
    expect(result.current.consent).toBe('declined');
  });

  it('allowing does not call either opt-out', () => {
    const { result } = renderHook(() => useAnalyticsConsent(), { wrapper });
    act(() => result.current.allowAnalytics());
    expect(disableProductAnalytics).not.toHaveBeenCalled();
    expect(result.current.consent).toBe('granted');
  });
});
