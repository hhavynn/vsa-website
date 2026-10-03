import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from './Footer';

jest.mock('../../context/AnalyticsConsentContext', () => ({
  useAnalyticsConsent: () => ({ isConfigured: false, openPreferences: () => undefined }),
}));

const renderFooter = () =>
  render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  );

describe('Footer public destinations', () => {
  it('keeps the secondary destinations that are not in the header or dock', () => {
    renderFooter();
    expect(screen.getByRole('link', { name: 'Find My Points' })).toHaveAttribute('href', '/points');
    expect(screen.getByRole('link', { name: 'Calendar' })).toHaveAttribute('href', '/calendar');
    expect(screen.getByRole('link', { name: 'Get Involved' })).toHaveAttribute('href', '/get-involved');
    expect(screen.getByRole('link', { name: 'UVSA Network' })).toHaveAttribute('href', '/uvsa-network');
  });

  it('puts feedback and privacy in the legal/help row, not duplicated in the nav groups', () => {
    renderFooter();
    expect(screen.getAllByRole('link', { name: 'Feedback' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Feedback' })).toHaveAttribute('href', '/feedback');
    expect(screen.getByRole('link', { name: 'Privacy Notice' })).toHaveAttribute('href', '/privacy');
  });

  it('never links into the admin area', () => {
    renderFooter();
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href') ?? '');
    expect(hrefs.filter((href) => href.startsWith('/admin'))).toEqual([]);
  });
});
