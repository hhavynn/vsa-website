import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FindMyPoints } from './FindMyPoints';

jest.mock('../../../hooks/useAcademicTerms', () => ({
  useAcademicTerms: () => ({ terms: [], loading: false }),
}));
jest.mock('../../../hooks/useLeaderboardYears', () => ({
  useLeaderboardYears: () => ({ yearsWithData: [2026], loading: false }),
}));
jest.mock('../../../hooks/useMemberAvatars', () => ({
  useMemberAvatars: () => new Map(),
}));
jest.mock('../../../hooks/useFindMyPoints', () => ({
  useFindMyPoints: () => ({
    data: [{
      member_id: 'synthetic-member',
      first_name: 'Example',
      last_name: 'Student',
      full_name: 'Example Student',
      college: null,
      graduation_year: null,
      house: null,
      total_points: 3,
      all_time_points: 3,
      events_attended: 1,
      rank: 1,
      tiedCount: 1,
    }],
    isLoading: false,
    isFetching: false,
    error: null,
  }),
}));

function renderLookup() {
  render(<MemoryRouter><FindMyPoints variant="page" /></MemoryRouter>);
}

describe('Find My Points live-result announcements (#322)', () => {
  it('provides a real associated label and only announces no-match on Enter or blur', () => {
    renderLookup();
    const search = screen.getByRole('textbox', { name: 'Search by name' });
    const status = screen.getByRole('status');
    expect(search).toHaveAttribute('aria-describedby');
    expect(screen.getByText(/Search results update as you type/)).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'Unknown Visitor' } });
    expect(screen.getByText(/No match for "Unknown Visitor"/)).toBeInTheDocument();
    expect(status).toHaveTextContent(/^$/);

    fireEvent.keyDown(search, { key: 'Enter', code: 'Enter' });
    expect(status).toHaveTextContent(/No matching member found/);

    fireEvent.change(search, { target: { value: 'Nobody Else' } });
    expect(status).toHaveTextContent(/^$/);
    fireEvent.blur(search);
    expect(status).toHaveTextContent(/No matching member found/);
  });

  it('explains probable missing points and offers correction and in-page points help', () => {
    renderLookup();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search by name' }), {
      target: { value: 'Unknown Visitor' },
    });
    expect(screen.getByText(/may not have been imported yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a correction' })).toHaveAttribute(
      'href', '/feedback?type=event&title=Points%20correction'
    );
    expect(screen.getByRole('link', { name: 'How points work' })).toHaveAttribute('href', '/points#how-points-work');
  });
});
