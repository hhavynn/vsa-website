import { fireEvent, render, screen, within } from '@testing-library/react';
import { HouseEventPlanningPanel } from './HouseEventPlanningPanel';
import { downloadBlob } from '../../../lib/story/storyCanvas';
import type { HouseEvent, HousePageAsset } from '../../../types';

jest.mock('../../../lib/story/storyCanvas', () => ({
  downloadBlob: jest.fn(),
}));

const twilight = {
  id: 'twilight', house_key: 'twilight', house: 'twilight', display_name: 'Twilight Sparkle',
  academic_year_start: 2026,
} as HousePageAsset;
const rarity = {
  id: 'rarity', house_key: 'rarity', house: 'rarity', display_name: 'Rarity',
  academic_year_start: 2026,
} as HousePageAsset;

function event(id: string, date: string, hosts: HousePageAsset[], published = true): HouseEvent {
  return {
    id, academic_year_start: 2026, event_date: date, houses: hosts, is_published: published,
  } as HouseEvent;
}

const base = {
  selectedYear: 2026,
  events: [
    event('collab', '2026-11-15', [twilight, rarity]),
    event('past', '2026-10-10', [twilight]),
    event('draft', '2027-01-10', [rarity], false),
  ],
  profiles: [twilight, rarity],
  today: '2026-10-28',
  loading: false,
  error: false,
  truncated: false,
};

it('shows every quarter, reuses the same event once globally, and never claims a past event was held', () => {
  render(<HouseEventPlanningPanel {...base} />);
  const table = screen.getByRole('table');
  expect(screen.getByText(/Past date means the calendar date passed/)).toBeInTheDocument();
  expect(screen.getByText('3', { selector: '.font-serif' })).toBeInTheDocument();
  expect(within(table).getByText('Twilight Sparkle')).toBeInTheDocument();
  expect(within(table).getByText('Rarity')).toBeInTheDocument();
  expect(within(table).getByRole('columnheader', { name: 'Winter' })).toBeInTheDocument();
  expect(within(table).getByRole('columnheader', { name: 'Spring' })).toBeInTheDocument();
  expect(within(table).getAllByText(/past date \(unverified\)/i).length).toBeGreaterThan(0);
});

it('exports only complete aggregate data, not member or attendance details', () => {
  render(<HouseEventPlanningPanel {...base} />);
  fireEvent.click(screen.getByRole('button', { name: 'Export aggregate CSV' }));
  expect(downloadBlob).toHaveBeenCalledTimes(1);
  expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'vsa-house-event-planning-2026-2027.csv');
});

it('does not export partial or failed event reads', () => {
  const { rerender } = render(<HouseEventPlanningPanel {...base} truncated />);
  expect(screen.getByRole('button', { name: 'Export aggregate CSV' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent(/counts may be incomplete/i);
  rerender(<HouseEventPlanningPanel {...base} error truncated={false} />);
  expect(screen.getByRole('button', { name: 'Export aggregate CSV' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent(/could not be loaded/i);
  rerender(<HouseEventPlanningPanel {...base} loading error={false} />);
  expect(screen.getByRole('button', { name: 'Export aggregate CSV' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
  expect(downloadBlob).not.toHaveBeenCalled();
});

it('uses selected-year Houses only, without carrying earlier House identities forward', () => {
  const old = { ...twilight, id: 'old', academic_year_start: 2025 } as HousePageAsset;
  render(<HouseEventPlanningPanel {...base} profiles={[old, rarity]} events={[]} />);
  const table = screen.getByRole('table');
  expect(within(table).queryByText('Twilight Sparkle')).not.toBeInTheDocument();
  expect(within(table).getByText('Rarity')).toBeInTheDocument();
});

it('blocks incomplete House-profile reads and offers an explicit retry', () => {
  const onRetry = jest.fn();
  const { rerender } = render(<HouseEventPlanningPanel {...base} error onRetry={onRetry} />);
  expect(screen.getByRole('button', { name: 'Export aggregate CSV' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent(/House profile records could not be loaded/);
  fireEvent.click(screen.getByRole('button', { name: 'Retry planning data' }));
  expect(onRetry).toHaveBeenCalledTimes(1);
  rerender(<HouseEventPlanningPanel {...base} loading onRetry={onRetry} />);
  expect(screen.getByRole('button', { name: 'Export aggregate CSV' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent(/Loading quarterly event counts/);
});
