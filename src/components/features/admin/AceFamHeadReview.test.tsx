import { fireEvent, render, screen } from '@testing-library/react';
import type { AceFamily, AceFamilyMember } from '../../../types';
import { AceFamHeadReview } from './AceFamHeadReview';

const family: AceFamily = {
  id: 'fam-1', academic_year_start: 2026, academic_year_end: 2027,
  name: 'Fictional', slug: 'fictional', description: null, cover_image_url: null,
  theme_color: null, display_order: 0, is_published: true, created_at: '', updated_at: '',
};
const head: AceFamilyMember = {
  id: 'node-1', family_id: family.id, name: 'Imaginary Person',
  role_label: 'Fam Head', member_id: 'm1', parent_member_id: null, is_published: true,
  display_order: 0, photo_url: null, created_at: '', updated_at: '',
};
const directory = new Map([
  ['m1',{ id: 'm1', fullName: 'Imaginary Person', displayName: 'Imaginary Person · Sixth',
    year: '2029', college: 'Sixth' }],
]);
it('shows explicit Fam Head only, member link, year and a deep link action to existing editor', () => {
  const review = jest.fn();
  render(<AceFamHeadReview family={family} nodes={[head, {...head, id:'little',name:'Other', role_label:'Little'}]}
    directoryById={directory} allLinks={[]} evidenceReady onReviewNode={review} />);
  expect(screen.getByText(/1 explicitly labeled/)).toHaveTextContent('1 source-ready');
  expect(screen.getByText(/Imaginary Person · Fam Head/)).toBeInTheDocument();
  expect(screen.queryByText(/Other · Little/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Review node' }));
  expect(review).toHaveBeenCalledWith('node-1');
});
it('does not count an unlinked head or draft as source-ready', () => {
  render(<AceFamHeadReview family={family}
    nodes={[{...head, member_id:null, is_published:false}]}
    directoryById={directory} allLinks={[]} evidenceReady onReviewNode={jest.fn()} />);
  expect(screen.getByText(/1 need review/)).toBeInTheDocument();
  expect(screen.getByText(/No canonical member link/)).toBeInTheDocument();
  expect(screen.getByText(/Unpublished family or head node/)).toBeInTheDocument();
});
it('treats an unavailable canonical directory as unknown rather than source-verified', () => {
  render(<AceFamHeadReview family={family} nodes={[head]}
    directoryById={new Map()} allLinks={[]} evidenceReady={false} onReviewNode={jest.fn()} />);
  expect(screen.getByRole('status')).toHaveTextContent(/eligibility is unknown/);
  expect(screen.queryByText(/source-ready/)).not.toBeInTheDocument();
});
