/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FamSheet } from './FamSheet';
import { AceFamily, AceFamilyMember } from '../../../types';
import { supabaseMock } from '../../../test-utils/supabaseMock';

jest.mock('../../../lib/supabase', () => ({
  get supabase() {
    return require('../../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const AVATAR_URL = 'https://example.test/storage/v1/object/public/avatars/approved/lynna.webp';

const family: AceFamily = {
  id: 'fam-sweatpants',
  academic_year_start: null,
  academic_year_end: null,
  name: 'Sweatpants',
  slug: 'sweatpants',
  cover_image_url: null,
  theme_color: null,
  description: null,
  display_order: 1,
  is_published: true,
  created_at: '',
  updated_at: '',
};

function member(overrides: Partial<AceFamilyMember>): AceFamilyMember {
  return {
    id: 'node',
    family_id: family.id,
    name: 'Someone',
    role_label: 'Little',
    photo_url: null,
    parent_member_id: null,
    member_id: null,
    display_order: 0,
    is_published: true,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

const members = [
  member({ id: 'node-big', name: 'Big Person', role_label: 'Big' }),
  member({ id: 'node-lynna', name: 'Lynna On', parent_member_id: 'node-big', member_id: 'member-lynna' }),
];

function renderSheet(onClose = () => {}, sheetMembers = members) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FamSheet family={family} members={sheetMembers} accent="teal" viet={null} dark={false} onClose={onClose} />
    </QueryClientProvider>,
  );
}

describe('FamSheet member photos', () => {
  beforeEach(() => {
    supabaseMock.reset();
    supabaseMock.setDefault('public_member_avatars', {
      data: [{ member_id: 'member-lynna', avatar_url: AVATAR_URL }],
      error: null,
    });
  });

  it('shows the shared avatar in a linked node and offers the photo update flow', async () => {
    const { container } = renderSheet();

    // SVG <image> has no accessible role, so the tree node is checked by markup.
    await waitFor(() => {
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector(`image[href="${AVATAR_URL}"]`)).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Lynna On, Little' }));

    expect(screen.getByRole('img', { name: 'Lynna On' })).toHaveAttribute('src', AVATAR_URL);
    expect(screen.getByRole('button', { name: 'Update photo' })).toBeEnabled();
  });

  it('selects nodes from the keyboard and explains why unlinked people cannot request yet', async () => {
    renderSheet();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Big Person, Big' }), { key: 'Enter' });

    expect(
      await screen.findByText('Photo requests open once a VSA admin links this name to a member record.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /photo/i })).not.toBeInTheDocument();
  });

  it('closes only the photo modal on Escape, leaving the family tree open', async () => {
    const onClose = jest.fn();
    renderSheet(onClose);

    fireEvent.click(screen.getByRole('button', { name: 'Lynna On, Little' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Update photo' }));
    expect(screen.getByRole('heading', { name: 'Request Profile Photo' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('heading', { name: 'Request Profile Photo' })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('moves focus into the photo dialog, keeps Tab inside it, and returns focus on close', async () => {
    renderSheet();

    fireEvent.click(screen.getByRole('button', { name: 'Lynna On, Little' }));
    const trigger = await screen.findByRole('button', { name: 'Update photo' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Request Profile Photo' });
    expect(dialog).toHaveFocus();

    const close = within(dialog).getByRole('button', { name: 'Close' });
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(cancel, { key: 'Tab' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Request Profile Photo' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe('FamSheet lineage spotlight', () => {
  // Root → Big → Big → Me, plus a sibling branch that must stay unlit.
  const lineageMembers = [
    member({ id: 'node-root', name: 'Root Founder', role_label: 'OG Founder' }),
    member({ id: 'node-big', name: 'Big One', role_label: 'Big', parent_member_id: 'node-root' }),
    member({ id: 'node-big2', name: 'Big Two', role_label: 'Big', parent_member_id: 'node-big' }),
    member({ id: 'node-me', name: 'Me Myself', role_label: 'Little', parent_member_id: 'node-big2' }),
    member({ id: 'node-side', name: 'Side Branch', role_label: 'Big', parent_member_id: 'node-root' }),
  ];

  beforeEach(() => {
    supabaseMock.reset();
    supabaseMock.setDefault('public_member_avatars', { data: [], error: null });
  });

  // Lets the shared-avatar query settle so its update lands inside act().
  async function renderLineageSheet() {
    const view = renderSheet(undefined, lineageMembers);
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    return view;
  }

  function lineageNames() {
    const nav = screen.getByRole('navigation', { name: /^Lineage of/ });
    return within(nav).getAllByRole('listitem').map((li) => li.textContent);
  }

  it('lists the lineage from the root down to the selected member', async () => {
    await renderLineageSheet();

    const me = screen.getByRole('button', { name: 'Me Myself, Little' });
    fireEvent.click(me);

    expect(lineageNames()).toEqual(['Root Founder', 'Big One', 'Big Two', 'Me Myself']);
    expect(screen.getByText('Me Myself', { selector: '[aria-current="true"]' })).toBeInTheDocument();
    expect(me).toHaveClass('is-lineage');
    expect(screen.getByRole('button', { name: 'Side Branch, Big' })).not.toHaveClass('is-lineage');
  });

  it('jumps to an ancestor from the lineage trail', async () => {
    await renderLineageSheet();

    fireEvent.click(screen.getByRole('button', { name: 'Me Myself, Little' }));
    fireEvent.click(screen.getByRole('button', { name: 'Big One' }));

    expect(lineageNames()).toEqual(['Root Founder', 'Big One']);
    expect(screen.getByRole('button', { name: 'Big One, Big' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clears the spotlight when the selected member is tapped again', async () => {
    await renderLineageSheet();

    const me = screen.getByRole('button', { name: 'Me Myself, Little' });
    fireEvent.click(me);
    expect(screen.getByTestId('ace-lineage')).toBeInTheDocument();

    fireEvent.click(me);

    expect(screen.queryByTestId('ace-lineage')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /^Lineage of/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Tap a member to trace their lineage/)).toBeInTheDocument();
    expect(me).toHaveAttribute('aria-pressed', 'false');
  });

  it('clears from the Clear button and returns focus to the member', async () => {
    await renderLineageSheet();

    const big2 = screen.getByRole('button', { name: 'Big Two, Big' });
    fireEvent.keyDown(big2, { key: 'Enter' });
    expect(lineageNames()).toEqual(['Root Founder', 'Big One', 'Big Two']);

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.queryByTestId('ace-lineage')).not.toBeInTheDocument();
    expect(big2).toHaveFocus();
  });

  it('switches the spotlight when another member is selected', async () => {
    await renderLineageSheet();

    fireEvent.click(screen.getByRole('button', { name: 'Me Myself, Little' }));
    const first = screen.getByTestId('ace-lineage');
    fireEvent.click(screen.getByRole('button', { name: 'Side Branch, Big' }));

    expect(screen.getByTestId('ace-lineage')).not.toBe(first);
    expect(lineageNames()).toEqual(['Root Founder', 'Side Branch']);
    expect(screen.getByRole('button', { name: 'Me Myself, Little' })).not.toHaveClass('is-lineage');
  });

  it('keeps the photo-request rail for the selected member', async () => {
    await renderLineageSheet();

    fireEvent.click(screen.getByRole('button', { name: 'Root Founder, OG Founder' }));

    expect(screen.queryByRole('navigation', { name: /^Lineage of/ })).not.toBeInTheDocument();
    expect(
      await screen.findByText('Photo requests open once a VSA admin links this name to a member record.'),
    ).toBeInTheDocument();
  });
});


describe('FamSheet published node deep links (#666)', () => {
  beforeEach(() => {
    supabaseMock.reset();
    supabaseMock.setDefault('public_member_avatars', { data: [], error: null });
  });

  it('opens a validated linked node selected and traces the existing ancestor path', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <FamSheet
          family={family}
          members={members}
          accent="teal"
          viet={null}
          dark={false}
          focusNodeId="node-lynna"
          onClose={() => {}}
        />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Lynna On', { selector: '.ace-rail-name' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Lineage of Lynna On' });
    expect(within(nav).getAllByRole('listitem').map((el) => el.textContent)).toEqual([
      'Big Person', 'Lynna On',
    ]);
    expect(screen.getByRole('button', { name: 'Lynna On, Little' })).toHaveClass('is-lineage');
    expect(screen.getByRole('button', { name: 'Copy member link' })).toBeInTheDocument();
  });

  it('updates focused node through the callback when navigating to a different published Big', async () => {
    const onFocusNodeChange = jest.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <FamSheet
          family={family}
          members={members}
          accent="teal"
          viet={null}
          dark={false}
          focusNodeId="node-lynna"
          onFocusNodeChange={onFocusNodeChange}
          onClose={() => {}}
        />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Big Person, Big' }));
    expect(onFocusNodeChange).toHaveBeenCalledWith('node-big');
    expect(screen.getByText('Big Person', { selector: '.ace-rail-name' })).toBeInTheDocument();
  });

  it('does not focus a nonexistent node supplied through a link', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <FamSheet
          family={family}
          members={members}
          accent="teal"
          viet={null}
          dark={false}
          focusNodeId="removed-node"
          onClose={() => {}}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText(/Tap a member to trace their lineage/)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /^Lineage of/ })).not.toBeInTheDocument();
  });
});


describe('chronological academic-year rail in real family sheet (#672)', () => {
  const dated = [
    member({ id: 'p', name: 'Fictional P', role_label: 'Big',
      pickup_academic_year_start: 2021, pickup_term: 'FA21' }),
    member({ id: 'a', name: 'Fictional A', role_label: 'Big', parent_member_id: 'p',
      pickup_academic_year_start: 2022, pickup_term: 'FA22' }),
    member({ id: 'b', name: 'Fictional B', role_label: 'Little', parent_member_id: 'p',
      pickup_academic_year_start: 2023, pickup_term: 'FA23' }),
    member({ id: 'c', name: 'Fictional C', role_label: 'Little', parent_member_id: 'a',
      pickup_academic_year_start: 2023, pickup_term: 'SP24' }),
    member({ id: 'unknown', name: 'Fictional Unknown', role_label: 'Little',
      parent_member_id: 'p', pickup_academic_year_start: null, pickup_term: null }),
  ];

  beforeEach(() => {
    supabaseMock.reset();
    supabaseMock.setDefault('public_member_avatars', { data: [], error: null });
  });

  it('shows one rail label per ordered year band and a separate Unknown band', () => {
    const { container } = renderSheet(() => {}, dated);
    expect(screen.getByText('Rows show the year each person was picked up.')).toBeInTheDocument();
    const rail = container.querySelector('.ace-year-rail');
    expect(rail).not.toBeNull();
    const keys = Array.from(rail!.querySelectorAll('[data-band-key]'), (el) => el.getAttribute('data-band-key'));
    expect(keys).toEqual(['unknown', '2021', '2022', '2023']);
    expect(rail).toHaveAttribute('aria-hidden', 'true');
    expect(rail!.querySelectorAll('[data-band-key]')).toHaveLength(
      container.querySelectorAll('[data-year-band]').length,
    );
    expect(screen.getByText('2023–24', { selector: '.ace-year-full' })).toBeInTheDocument();
    expect(screen.getByText('Unknown pickup year', { selector: '.ace-year-full' })).toBeInTheDocument();
  });

  it('focuses one real year band without changing the generations metadata', () => {
    const { container } = renderSheet(() => {}, dated);
    expect(screen.getByText(/5 members · 3 generations/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fictional B, Little, picked up 2023–24' }));
    expect(container.querySelector('.ace-year-band.is-focus')).toHaveAttribute('data-year-band', '2023');
    expect(container.querySelector('.ace-year-label.is-focus')).toHaveAttribute('data-band-key', '2023');
    expect(screen.getByText('Picked up: Fall 2023 · 2023–24')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fictional C, Little, picked up 2023–24' }));
    expect(screen.getByText('Picked up: Spring 2024 · 2023–24')).toBeInTheDocument();
  });

  it('shows year-only and unknown descriptions, without leaking evidence confidence', () => {
    const yearOnly = dated.map((m) => m.id === 'c' ? { ...m, pickup_term: null } : m);
    renderSheet(() => {}, yearOnly);
    fireEvent.click(screen.getByRole('button', { name: 'Fictional C, Little, picked up 2023–24' }));
    expect(screen.getByText('Picked up: 2023–24 (term unknown)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fictional Unknown, Little, pickup year unverified' }));
    expect(screen.getByText('Pickup year unverified')).toBeInTheDocument();
    expect(screen.queryByText(/unreviewed|candidate evidence|source confidence/i)).not.toBeInTheDocument();
  });

  it('does not invent a chronological rail for an entirely undated family', () => {
    const { container } = renderSheet();
    expect(container.querySelector('.ace-year-rail')).toBeNull();
    expect(screen.getByText('Rows show generations. Pickup years are still being verified.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lynna On, Little' })).toBeInTheDocument();
  });

  it('pins the rail against horizontal panning and scales its labels inversely', () => {
    const { container } = renderSheet(() => {}, dated);
    const viewport = container.querySelector('.ace-tree-panviewport') as HTMLDivElement;
    const canvas = container.querySelector('.ace-tree-canvas') as HTMLDivElement;
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 400 },
      clientHeight: { configurable: true, value: 300 },
    });
    Object.defineProperties(canvas, {
      offsetWidth: { configurable: true, value: 800 },
      offsetHeight: { configurable: true, value: 640 },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset family tree view' }));
    const rail = container.querySelector('.ace-year-rail') as HTMLElement;
    expect(canvas.style.transform).toContain('translate3d(116px');
    expect(rail.style.transform).toContain('translateX(-116px)');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in family tree' }));
    const updated = container.querySelector('.ace-year-rail') as HTMLElement;
    expect(updated.style.transform).toContain('translateX(');
    const year = updated.querySelector('.ace-year-label') as HTMLElement;
    expect(year.style.transform).toContain('scale(0.8333333333333334)');
  });
});
