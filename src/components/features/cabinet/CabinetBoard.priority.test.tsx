import { render, screen } from '@testing-library/react';
import { CabinetBoard } from './CabinetBoard';
import { type CabinetMemberRaw } from '../../../hooks/useCabinet';

jest.mock('../../../hooks/useMemberAvatars', () => ({
  useMemberAvatars: () => ({}),
}));

const member = (id: string, role: string, category = 'Executive Board'): CabinetMemberRaw => ({
  id,
  name: `Member ${id}`,
  role,
  category,
  display_order: 0,
  image_url: `https://x.supabase.co/storage/v1/object/public/cabinet_images/${id}.webp`,
  thumbnail_url: `https://x.supabase.co/storage/v1/object/public/cabinet_images/thumbs/${id}.webp`,
  year: null,
  college: null,
  major: null,
  minor: null,
  pronouns: null,
  favorite_snack: null,
  fun_fact: null,
  cabinet_year_id: null,
  member_id: null,
});

const photos = () => screen.getAllByRole('img');
const eager = () => photos().filter((img) => img.getAttribute('loading') === 'eager');

describe('CabinetBoard image priority budget', () => {
  it('spends at most two eager/high-priority photos on the whole page, on the topmost ones', () => {
    const members = [
      member('p1', 'President'),
      member('p2', 'President'),
      member('p3', 'Co-President'), // a second president panel must not get its own budget
      member('v1', 'Internal Vice President'),
      member('v2', 'External Vice President'),
      member('s1', 'Secretary'),
      member('g1', 'Events Chair', 'General Board'),
      member('i1', 'Intern', 'Interns'),
    ];
    render(<CabinetBoard members={members} revealOnScroll={false} />);

    const eagerImgs = eager();
    expect(eagerImgs.length).toBeGreaterThan(0);
    expect(eagerImgs.length).toBeLessThanOrEqual(2);
    eagerImgs.forEach((img) => expect(img.getAttribute('fetchpriority')).toBe('high'));
    // They are the page's first two photos in document order (the presidents' panels), and
    // the third president, rendered after them, is lazy.
    const allImgs = photos();
    expect(eagerImgs).toEqual(allImgs.slice(0, 2));
    expect(allImgs.slice(0, 3).map((img) => img.getAttribute('alt')).sort()).toEqual(['Member p1', 'Member p2', 'Member p3']);

    // Everything else is lazy and carries explicit dimensions.
    const lazyImgs = photos().filter((img) => img.getAttribute('loading') === 'lazy');
    expect(lazyImgs.length).toBe(photos().length - eagerImgs.length);
    lazyImgs.forEach((img) => {
      expect(img).not.toHaveAttribute('fetchpriority');
      expect(img).toHaveAttribute('width');
      expect(img).toHaveAttribute('height');
    });
  });

  it('does not reset the budget per role: several featured roles still total at most two', () => {
    const members = [
      member('a1', 'President'),
      member('a2', 'President'),
      member('b1', 'Vice President'),
      member('b2', 'Vice President'),
      member('c1', 'Treasurer'),
    ];
    render(<CabinetBoard members={members} revealOnScroll={false} />);
    expect(eager().length).toBeLessThanOrEqual(2);
  });

  it('marks nothing eager when there is no president panel', () => {
    const members = [member('v1', 'Internal Vice President'), member('s1', 'Secretary'), member('g1', 'Chair', 'General Board')];
    render(<CabinetBoard members={members} revealOnScroll={false} />);
    expect(eager()).toHaveLength(0);
  });
});
