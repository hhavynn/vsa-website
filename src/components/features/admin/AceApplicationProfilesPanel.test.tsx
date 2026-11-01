import { fireEvent, render, screen, within } from '@testing-library/react';
import { AceApplicationProfilesPanel } from './AceApplicationProfilesPanel';
import type { AceApplicationSummary } from '../../../hooks/useAceApplicationProfiles';

const summary: AceApplicationSummary = {
  bigCount: 1,
  littleCount: 1,
  repeatsReplaced: 0,
  skipped: 0,
  unmatched: [],
  warnings: [],
  emailLookupFailed: false,
  reciprocalPreferences: [{
    bigId: 'big-fake',
    littleId: 'little-fake',
    bigName: 'Mina Tran',
    littleName: 'Ari Lee',
    needsNameReview: true,
  }],
};

it('shows named reciprocity as a private review signal, not a confirmed match', () => {
  render(<AceApplicationProfilesPanel summary={summary} onLoad={jest.fn()} onClear={jest.fn()} onClose={jest.fn()} />);
  fireEvent.click(screen.getByText('Potential two-way named preferences · 1'));
  const list = screen.getByRole('list', { name: 'Potential two-way named preferences' });
  expect(within(list).getByText('Mina Tran')).toBeInTheDocument();
  expect(within(list).getByText('Ari Lee')).toBeInTheDocument();
  expect(within(list).getByText('First-name mention — confirm identity')).toBeInTheDocument();
  expect(screen.getByText(/not guarantees, approved pairs or assignments/i)).toBeInTheDocument();
});

it('explains that zero detected reciprocal preferences is not proof of absence', () => {
  render(<AceApplicationProfilesPanel summary={{ ...summary, reciprocalPreferences: [] }} onLoad={jest.fn()} onClear={jest.fn()} onClose={jest.fn()} />);
  fireEvent.click(screen.getByText('Potential two-way named preferences · 0'));
  expect(screen.getByText(/does not rule out requests written another way/i)).toBeInTheDocument();
});
