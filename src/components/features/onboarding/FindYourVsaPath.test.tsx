import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { PublicApplicationLink } from '../../../types';
import { FindYourVsaPath, getPathWindowStatus } from './FindYourVsaPath';

const mockUsePublicApplicationLinks = jest.fn();
jest.mock('../../../hooks/useApplicationLinks', () => ({
  usePublicApplicationLinks: () => mockUsePublicApplicationLinks(),
}));

const link = (application_key: PublicApplicationLink['application_key'], status: PublicApplicationLink['status'], target_url: string | null = null) =>
  ({ application_key, status, target_url } as PublicApplicationLink);

function mount() {
  return render(<MemoryRouter><FindYourVsaPath /></MemoryRouter>);
}

beforeEach(() => {
  mockUsePublicApplicationLinks.mockReturnValue({
    links: [
      link('house_fall', 'closed', 'https://secret.invalid/closed-house'),
      link('house_winter', 'not_open', null),
      link('ace_application', 'open', 'https://example.invalid/open-ace'),
    ],
    loading: false,
    error: null,
  });
});

describe('new member VSA path guide (#283)', () => {
  it('starts at public events with no application required', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Just want to show up' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Start with VSA events' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See upcoming events' })).toHaveAttribute('href', '/events');
    expect(screen.queryByText(/Application window announced/)).not.toBeInTheDocument();
  });

  it('makes House and ACE distinct, with no closed application link in the DOM', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Find a smaller community' }));
    expect(screen.getByRole('heading', { name: 'Explore the House System' })).toBeInTheDocument();
    expect(screen.getByText(/House is NOT the same as ACE mentorship/)).toBeInTheDocument();
    expect(screen.getByText('Application window announced, not open yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Learn about this program' })).toHaveAttribute('href', '/house-system');

    await userEvent.click(screen.getByRole('button', { name: 'Find a mentor or mentee' }));
    expect(screen.getByText(/separate from House competitions/)).toBeInTheDocument();
    expect(screen.getByText('Application or interest form open now')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Learn about this program' })).toHaveAttribute('href', '/ace');
    expect(screen.getByRole('link', { name: 'See what’s open now' })).toHaveAttribute('href', '/get-involved#open-opportunities');

    const urls = screen.getAllByRole('link').map((el) => el.getAttribute('href'));
    expect(urls).not.toContain('https://secret.invalid/closed-house');
    expect(urls).not.toContain('https://example.invalid/open-ace');
  });

  it('offers six keyboard-operable choices and a single current recommendation', async () => {
    mount();
    const choices = screen.getByRole('group', { name: 'Choose what interests you' });
    expect(within(choices).getAllByRole('button')).toHaveLength(6);
    await userEvent.click(within(choices).getByRole('button', { name: 'Create or perform' }));
    expect(screen.getByRole('heading', { name: 'Explore Vietnamese Culture Night' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Explore the House System' })).not.toBeInTheDocument();
    expect(within(choices).getByRole('button', { name: 'Create or perform' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('handles missing application data without claiming an open window', async () => {
    mockUsePublicApplicationLinks.mockReturnValue({ links: [], loading: true, error: null });
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Try out leadership' }));
    expect(screen.getByRole('link', { name: 'Learn about this program' })).toHaveAttribute('href', '/intern-program');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not treat an open status with no authorized URL as an actionable window', () => {
    expect(getPathWindowStatus(['ace_application'], [link('ace_application', 'open', null)])).toBe('No application window announced yet');
    expect(getPathWindowStatus(['house_fall'], [link('house_fall', 'closed', 'https://secret.invalid/form')])).toBe('This application cycle has closed');
    expect(getPathWindowStatus([], [])).toBeNull();
  });
});
