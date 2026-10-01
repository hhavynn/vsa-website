import { fireEvent, render, screen } from '@testing-library/react';
import { AceLinkReviewPanel } from './AceLinkReviewPanel';
import { reviewUnlinkedNodes } from '../../../lib/aceMemberLinks';
import { buildMemberNameIndex, toMemberOption } from '../../../lib/memberLinkMatching';
import type { AceFamilyMember } from '../../../types';

const node = (id: string, name: string): AceFamilyMember => ({
  id,
  family_id: 'fam-1',
  name,
  role_label: null,
  photo_url: null,
  parent_member_id: null,
  member_id: null,
  display_order: 0,
  is_published: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const index = buildMemberNameIndex([
  toMemberOption({ id: 'm-tommy', first_name: 'Tommy', last_name: 'Tran', college: 'Sixth', year: 'Third Year' }),
  toMemberOption({ id: 'm-jen', first_name: 'Jennifer', last_name: 'Nguyen', college: 'Muir', year: 'Second Year' }),
  toMemberOption({ id: 'm-andy-1', first_name: 'Andy', last_name: 'Tran', college: 'Seventh', year: null }),
  toMemberOption({ id: 'm-andy-2', first_name: 'Andy', last_name: 'Tran', college: 'Muir', year: null }),
]);

const items = reviewUnlinkedNodes(
  [node('n1', 'Tommy Tran'), node('n2', 'Jennifer Nguyen'), node('n3', 'Andy Tran'), node('n4', 'Old Alumni Name')],
  index,
  [],
);

function renderPanel() {
  const onApply = jest.fn();
  const onLinkOne = jest.fn();
  render(<AceLinkReviewPanel items={items} onApply={onApply} onLinkOne={onLinkOne} onClose={jest.fn()} busy={false} />);
  return { onApply, onLinkOne };
}

it('groups unlinked nodes and pre-selects only exact unique matches', () => {
  renderPanel();
  expect(screen.getByText('Exact matches (2)')).toBeInTheDocument();
  expect(screen.getByText('Needs manual review (1)')).toBeInTheDocument();
  expect(screen.getByText('No member record (1)')).toBeInTheDocument();
  expect(screen.getByText(/2 possible members/)).toBeInTheDocument();
  expect(screen.getAllByRole('checkbox')).toHaveLength(2);
});

it('bulk-links only the reviewed unique matches the admin left checked', () => {
  const { onApply } = renderPanel();
  fireEvent.click(screen.getByRole('checkbox', { name: /Jennifer Nguyen/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Link 1 obvious match' }));
  expect(onApply).toHaveBeenCalledWith([{ nodeId: 'n1', memberId: 'm-tommy' }]);
});

it('requires a per-person choice for ambiguous names', () => {
  const { onApply, onLinkOne } = renderPanel();
  fireEvent.click(screen.getByRole('button', { name: 'Link 2 obvious matches' }));
  expect(onApply).toHaveBeenCalledWith([
    { nodeId: 'n1', memberId: 'm-tommy' },
    { nodeId: 'n2', memberId: 'm-jen' },
  ]);

  fireEvent.click(screen.getByRole('button', { name: 'Link Andy Tran to Andy Tran · Muir' }));
  expect(onLinkOne).toHaveBeenCalledWith('n3', expect.objectContaining({ id: 'm-andy-2' }));
});
