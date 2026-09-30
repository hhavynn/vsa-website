import { fireEvent, render, screen } from '@testing-library/react';
import { GhostFamCard } from './GhostFamCard';
import { AceFamily } from '../../../types';

const family: AceFamily = {
  id: 'fam-dead-bad-decisions',
  academic_year_start: null,
  academic_year_end: null,
  name: '(Dead) Bad Decisions',
  slug: 'dead-bad-decisions',
  cover_image_url: null,
  theme_color: null,
  description: null,
  display_order: 0,
  is_published: true,
  created_at: '',
  updated_at: '',
};

describe('GhostFamCard', () => {
  it('shows the fam without its "(Dead)" prefix and opens its tree', () => {
    const onOpen = jest.fn();
    render(<GhostFamCard family={family} accent="coral" memberCount={34} gens={1} onOpen={onOpen} />);

    const card = screen.getByRole('button', { name: /bad decisions/i });
    expect(card).not.toHaveTextContent('(Dead)');
    expect(card).toHaveTextContent('R.I.P.');
    expect(card).toHaveTextContent('34 members');
    expect(card).toHaveTextContent('1 gen');
    expect(card).toHaveTextContent('View family tree');

    fireEvent.click(card);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
