import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Top3StoryDialog } from './Top3StoryDialog';
import type { Top3StoryData } from '../../../hooks/useTop3StoryData';

let mockData: Top3StoryData;

jest.mock('../../../hooks/useTop3StoryData', () => ({
  useTop3StoryData: () => mockData,
}));
jest.mock('../../../lib/story/storyCanvas', () => ({
  ...jest.requireActual('../../../lib/story/storyCanvas'),
  ensureStoryFonts: () => Promise.resolve(),
  loadStoryImage: () => Promise.resolve(null),
}));
jest.mock('../../../lib/story/drawTop3Story', () => ({
  drawTop3Story: jest.fn(),
}));

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

const entry = (rank: 1 | 2 | 3, name: string, points: number) => ({
  rank,
  memberId: name,
  name,
  points,
  pointsLabel: points.toLocaleString('en-US'),
  avatarUrl: null,
  house: null,
});

describe('Top3StoryDialog', () => {
  it('lists the Top 3 and enables export once the story is ready', async () => {
    mockData = {
      academicYearStart: 2026,
      entries: [entry(1, 'An Nguyen', 1240), entry(2, 'Bao Tran', 980), entry(3, 'Chi Le', 975)],
      loading: false,
      error: null,
    };
    render(<Top3StoryDialog onClose={() => undefined} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Download Story Image' })).toBeEnabled());
    expect(screen.getByText(/Current public leaderboard \(2026–27\)/)).toBeInTheDocument();
    expect(screen.getByText('An Nguyen')).toBeInTheDocument();
    expect(screen.getByText('1,240 pts')).toBeInTheDocument();
    expect(screen.getByText('Chi Le')).toBeInTheDocument();
  });

  it('switches the headline preset', async () => {
    mockData = { academicYearStart: 2026, entries: [entry(1, 'An Nguyen', 10)], loading: false, error: null };
    render(<Top3StoryDialog onClose={() => undefined} />);

    const crown = await screen.findByRole('radio', { name: /Take the crown/ });
    expect(screen.getByRole('radio', { name: /Current Top 3/ })).toBeChecked();
    fireEvent.click(crown);
    expect(crown).toBeChecked();
  });

  it('switches between dark and light looks', async () => {
    mockData = { academicYearStart: 2026, entries: [entry(1, 'An Nguyen', 10)], loading: false, error: null };
    render(<Top3StoryDialog onClose={() => undefined} />);

    const light = await screen.findByRole('radio', { name: 'Light' });
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    fireEvent.click(light);
    expect(light).toBeChecked();
  });

  it('shows an empty state and disables export when the year has no points', async () => {
    mockData = { academicYearStart: 2026, entries: [], loading: false, error: null };
    render(<Top3StoryDialog onClose={() => undefined} />);

    expect(await screen.findByText('No leaderboard points recorded for this year yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Story Image' })).toBeDisabled();
  });
  it('offers Top 5 and Top 10 without removing the default Top 3 preset', async () => {
    mockData = {
      academicYearStart: 2026,
      entries: [entry(1, 'Fictional An', 1200), entry(2, 'Fictional Bao', 900)],
      loading: false,
      error: null,
    };
    render(<Top3StoryDialog onClose={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Top 3 Story' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Top 3' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Top 5' }));
    expect(screen.getByRole('heading', { name: 'Top 5 Story' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Top 5' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Current Top 3/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Top 10' }));
    expect(screen.getByRole('heading', { name: 'Top 10 Story' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download Story Image' })).toBeEnabled());
  });

  it('warns about a cutoff tie instead of silently splitting equally ranked members', async () => {
    mockData = {
      academicYearStart: 2026,
      entries: [entry(1, 'Fictional An', 1200)],
      loading: false,
      error: null,
      excludedBoundaryTie: 2,
      excludedRank: 2,
    };
    render(<Top3StoryDialog onClose={() => undefined} />);
    expect(await screen.findByRole('status')).toHaveTextContent(/2 tied members at rank 2/);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download Story Image' })).toBeEnabled());
  });

});


it('lets an admin choose the verified Board cohort before creating a Top N Story', async () => {
  mockData = {
    academicYearStart: 2026, entries: [entry(1, 'Fictional Officer', 1250)], loading: false, error: null,
  };
  render(<Top3StoryDialog onClose={() => undefined} />);
  expect(screen.getByRole('radio', { name: 'Members' })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: 'Board' }));
  expect(screen.getByRole('radio', { name: 'Board' })).toBeChecked();
  expect(screen.getByText(/Board leaderboard \(2026–27\)/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: 'Top 10' }));
  expect(screen.getByRole('heading', { name: 'Top 10 Story' })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Download Story Image' })).toBeEnabled());
});

it('blocks export instead of publishing a mislabeled Member cohort when roster read fails', async () => {
  mockData = {
    academicYearStart: 2026, entries: [], loading: false, error: null, cohortUnavailable: true,
  };
  render(<Top3StoryDialog onClose={() => undefined} />);
  expect(screen.getByText(/Verified Board roster is unavailable/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Download Story Image' })).toBeDisabled();
});
