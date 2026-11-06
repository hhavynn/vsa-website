import { fireEvent, render, screen } from '@testing-library/react';
import { InternCard } from './Internship';
import type { CabinetIntern } from '../hooks/useCabinetInterns';

let mockAvatars: ReadonlyMap<string, string> = new Map();
jest.mock('../hooks/useMemberAvatars', () => ({
  useMemberAvatars: () => mockAvatars,
}));

function intern(overrides: Partial<CabinetIntern> = {}): CabinetIntern {
  return {
    id: 'intern-1',
    name: 'Fictional Student',
    role: 'Intern',
    display_order: 0,
    image_url: '/images/cabinet/intern-full.webp',
    thumbnail_url: '/images/cabinet/intern-thumb.webp',
    cabinet_year_id: 'year-1',
    member_id: 'member-1',
    ...overrides,
  };
}

beforeEach(() => {
  mockAvatars = new Map();
});

describe('public Intern cohort portraits (#303)', () => {
  it('uses the shared image delivery contract without eagerly loading the whole grid', () => {
    render(<InternCard intern={intern()} />);
    const photo = screen.getByRole('img', { name: 'Fictional Student' });
    expect(photo).toHaveAttribute('src', '/images/cabinet/intern-thumb.webp');
    expect(photo).toHaveAttribute('width', '360');
    expect(photo).toHaveAttribute('height', '450');
    expect(photo).toHaveAttribute('loading', 'lazy');
    expect(photo).toHaveAttribute('decoding', 'async');
    expect(photo).not.toHaveAttribute('fetchpriority');
  });

  it('keeps the member name and accessible card when a public image fails', () => {
    render(<InternCard intern={intern()} />);
    fireEvent.error(screen.getByRole('img', { name: 'Fictional Student' }));
    expect(screen.queryByRole('img', { name: 'Fictional Student' })).not.toBeInTheDocument();
    expect(screen.getByText('FS')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fictional Student' })).toBeInTheDocument();
  });

  it('shows initials when the cohort has no published photo', () => {
    render(<InternCard intern={intern({ image_url: null, thumbnail_url: null })} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('FS')).toBeInTheDocument();
  });

  it('preserves an approved canonical member avatar over the local intern thumbnail', () => {
    mockAvatars = new Map([['member-1', '/images/approved-member.webp']]);
    render(<InternCard intern={intern()} />);
    expect(screen.getByRole('img', { name: 'Fictional Student' }))
      .toHaveAttribute('src', '/images/approved-member.webp');
  });
});
