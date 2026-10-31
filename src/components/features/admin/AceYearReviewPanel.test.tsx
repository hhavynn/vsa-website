import { fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import type { AceFamilyMember } from '../../../types';
import type { AcePickupEvidenceRow } from '../../../data/repos/aceFamilies';
import { reviewFamilyYears } from '../../../lib/aceYearReview';
import { AceYearReviewPanel } from './AceYearReviewPanel';

function node(id: string, values: Partial<AceFamilyMember> = {}): AceFamilyMember {
  return {
    id, family_id: 'synthetic-family', name: 'Fictional ' + id, role_label: 'Little',
    photo_url: null, parent_member_id: null, member_id: null, display_order: 0,
    is_published: true, created_at: '', updated_at: '',
    pickup_academic_year_start: null, pickup_term: null, ...values,
  };
}
function evidence(id: string, nodeId: string, year: number, term: string): AcePickupEvidenceRow {
  return {
    id, ace_member_id: nodeId, source_kind: 'import_json',
    source_label: 'Fictional document', raw_value: term,
    candidate_academic_year_start: year, candidate_term: term,
    review_status: 'pending', reviewed_at: null,
  };
}
function view(nodes: AceFamilyMember[], records: AcePickupEvidenceRow[] = []) {
  return reviewFamilyYears(nodes, records);
}

it('never exposes partial names, counts or conclusions while a private evidence read is pending', () => {
  const nodes = [node('late')];
  render(<AceYearReviewPanel familyName="Synthetic" nodes={nodes}
    reviews={view(nodes)} ready={false} loading failed={false} onReviewNode={jest.fn()} />);
  const panel = screen.getByRole('region', { name: 'ACE pickup-year review' });
  expect(within(panel).getByRole('status')).toHaveTextContent(/Checking approved years/);
  expect(within(panel).queryByText('Fictional late')).not.toBeInTheDocument();
  expect(within(panel).queryByRole('button')).not.toBeInTheDocument();
  expect(within(panel).queryByText(/1 flagged/)).not.toBeInTheDocument();
});

it('fails closed on denied or incomplete reads without saying no problems were found', () => {
  const nodes = [node('private')];
  render(<AceYearReviewPanel familyName="Synthetic" nodes={nodes}
    reviews={view(nodes)} ready={false} loading={false} failed onReviewNode={jest.fn()} />);
  expect(screen.getByRole('alert')).toHaveTextContent(/could not be checked/);
  expect(screen.queryByText('Fictional private')).not.toBeInTheDocument();
  expect(screen.queryByText(/No year-review flags/)).not.toBeInTheDocument();
});

it('shows approved years, conflicting sources, unknown counts and exact node navigation', () => {
  const big = node('big', { name: 'Fictional Big', pickup_academic_year_start: 2022, pickup_term: 'FA22' });
  const little = node('little', { name: 'Fictional Little', parent_member_id: big.id,
    pickup_academic_year_start: 2023, pickup_term: 'FA23' });
  const missing = node('missing', { name: 'Fictional Undated' });
  const records = [evidence('ev-one', little.id, 2023, 'FA23'), evidence('ev-two', little.id, 2024, 'FA24')];
  const nodes = [big, little, missing];
  const onReviewNode = jest.fn();
  render(<AceYearReviewPanel familyName="Synthetic Family" nodes={nodes}
    reviews={view(nodes, records)} ready loading={false} failed={false} onReviewNode={onReviewNode} />);
  const panel = screen.getByRole('region', { name: 'Pickup-year review' });
  expect(within(panel).getByRole('status')).toHaveTextContent('3 nodes checked');
  expect(within(panel).getByRole('status')).toHaveTextContent('2 flagged');
  expect(within(panel).getByRole('status')).toHaveTextContent('1 unknown year');
  expect(within(panel).getByRole('status')).toHaveTextContent('1 evidence conflict');
  expect(within(panel).queryByText('Fictional Big')).not.toBeInTheDocument();
  expect(within(panel).getByText('Fictional Little')).toBeInTheDocument();
  expect(within(panel).getByText('Approved pickup: FA23 · Needs review')).toBeInTheDocument();
  expect(within(panel).getByText('Conflicting year or term evidence')).toBeInTheDocument();
  expect(within(panel).getByText('Fictional Undated')).toBeInTheDocument();
  fireEvent.click(within(panel).getByRole('button', { name: 'Review ACE node Fictional Little, id little' }));
  expect(onReviewNode).toHaveBeenCalledWith('little');
});

it('preserves same-name people as separate review rows, using stable node IDs', () => {
  const nodes = [
    node('node-one', { name: 'Fictional Same', pickup_academic_year_start: 2022 }),
    node('node-two', { name: 'Fictional Same', pickup_academic_year_start: 2023 }),
  ];
  const onReviewNode = jest.fn();
  render(<AceYearReviewPanel familyName="Synthetic" nodes={nodes}
    reviews={view(nodes)} ready loading={false} failed={false} onReviewNode={onReviewNode} />);
  const panel = screen.getByRole('region', { name: 'Pickup-year review' });
  expect(within(panel).getAllByText('Fictional Same')).toHaveLength(2);
  expect(within(panel).getAllByText('Duplicate name or member link; verify node identity')).toHaveLength(2);
  fireEvent.click(within(panel).getByRole('button', { name: 'Review ACE node Fictional Same, id node-two' }));
  expect(onReviewNode).toHaveBeenCalledWith('node-two');
});

it('does not claim historical completeness for a clean fictional family', () => {
  const nodes = [node('known', { pickup_academic_year_start: 2023, pickup_term: 'FA23' })];
  render(<AceYearReviewPanel familyName="Synthetic" nodes={nodes}
    reviews={view(nodes)} ready loading={false} failed={false} onReviewNode={jest.fn()} />);
  expect(screen.getByText(/does not verify historical source completeness/)).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('has accessible labels for review controls and status', async () => {
  const nodes = [node('unknown')];
  const { container } = render(<AceYearReviewPanel familyName="Synthetic" nodes={nodes}
    reviews={view(nodes)} ready loading={false} failed={false} onReviewNode={jest.fn()} />);
  expect(await axe(container)).toHaveNoViolations();
});
