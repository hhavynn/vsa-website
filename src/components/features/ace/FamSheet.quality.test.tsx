/* eslint-disable testing-library/no-container, testing-library/no-node-access */
// #675: real DOM/SVG characterizations of the chronological tree, never mocked layout.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { axe, toHaveNoViolations } from 'jest-axe';
import { FamSheet } from './FamSheet';
import type { AceFamily, AceFamilyMember } from '../../../types';
import { supabaseMock } from '../../../test-utils/supabaseMock';

jest.mock('../../../lib/supabase', () => ({
  get supabase() {
    return require('../../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

expect.extend(toHaveNoViolations);

const family: AceFamily = {
  id: 'synthetic-ace-fam', name: 'Fictional Family', slug: 'fictional-family',
  academic_year_start: null, academic_year_end: null, cover_image_url: null,
  theme_color: null, description: null, display_order: 1, is_published: true,
  created_at: '', updated_at: '',
};

function node(
  id: string,
  name: string,
  parent: string | null,
  year: number | null,
  term: string | null,
): AceFamilyMember {
  return {
    id, name, family_id: family.id, parent_member_id: parent,
    role_label: parent ? 'Little' : 'Big', member_id: null,
    photo_url: null, display_order: 0, is_published: true,
    pickup_academic_year_start: year, pickup_term: term,
    created_at: '', updated_at: '',
  };
}

const golden = [
  node('p', 'Fictional P', null, 2021, 'FA21'),
  node('a', 'Fictional A', 'p', 2022, 'FA22'),
  node('b', 'Fictional B', 'p', 2023, 'FA23'),
  node('c', 'Fictional C', 'a', 2023, 'SP24'),
  node('unknown', 'Fictional Unknown', 'p', null, null),
];

function renderTree(
  members: AceFamilyMember[],
  options: { focusNodeId?: string; onFocusNodeChange?: (id: string | null) => void } = {},
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <FamSheet
        family={family} members={members} accent="teal" viet={null}
        dark={false} onClose={() => {}} {...options}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  supabaseMock.reset();
  supabaseMock.setDefault('public_member_avatars', { data: [], error: null });
});

describe('ACE chronological tree acceptance (#675)', () => {
  it('positions the actual SVG guides and HTML rail labels using identical band geometry', () => {
    const { container } = renderTree(golden);
    const labels = Array.from(container.querySelectorAll<HTMLElement>('.ace-year-label[data-band-key]'));
    const guides = Array.from(container.querySelectorAll<SVGRectElement>('svg [data-year-band]'));
    expect(labels.map((el) => el.dataset.bandKey)).toEqual(['unknown', '2021', '2022', '2023']);
    expect(guides.map((el) => el.getAttribute('data-year-band'))).toEqual(
      labels.map((el) => el.dataset.bandKey),
    );
    expect(guides).toHaveLength(4);
    for (let i = 0; i < labels.length; i += 1) {
      const guideY = Number(guides[i].getAttribute('y'));
      const guideHeight = Number(guides[i].getAttribute('height'));
      // Both renderers must use bandRect; a divergent helper moves these apart.
      expect(Number.parseFloat(labels[i].style.top)).toBeCloseTo(guideY + guideHeight / 2, 5);
    }
    expect(container.querySelectorAll('.ace-tree-node')).toHaveLength(golden.length);
  });

  it('keeps a deep-linked lineage, selected row and role accessible after zoom and keyboard pan', () => {
    const onFocusNodeChange = jest.fn();
    const { container } = renderTree(golden, { focusNodeId: 'c', onFocusNodeChange });
    const selected = screen.getByRole('button', { name: 'Fictional C, Little, picked up 2023–24' });
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    const lineage = screen.getByRole('navigation', { name: 'Lineage of Fictional C' });
    expect(within(lineage).getAllByRole('listitem').map((el) => el.textContent)).toEqual([
      'Fictional P', 'Fictional A', 'Fictional C',
    ]);
    expect(container.querySelector('.ace-year-band.is-focus')).toHaveAttribute('data-year-band', '2023');
    const canvas = container.querySelector('.ace-tree-canvas') as HTMLDivElement;
    const viewport = container.querySelector('.ace-tree-panviewport') as HTMLDivElement;
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 420 },
      clientHeight: { configurable: true, value: 340 },
    });
    Object.defineProperties(canvas, {
      offsetWidth: { configurable: true, value: 960 },
      offsetHeight: { configurable: true, value: 680 },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset family tree view' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in family tree' }));
    expect(canvas.style.transform).toContain('scale(1.2)');
    fireEvent.keyDown(viewport, { key: 'ArrowRight' });
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.ace-year-label.is-focus')).toHaveAttribute('data-band-key', '2023');
    expect(container.querySelector('.ace-year-band.is-focus')).toHaveAttribute('data-year-band', '2023');
    fireEvent.click(screen.getByRole('button', { name: 'Fictional A, Little, picked up 2022–23' }));
    expect(onFocusNodeChange).toHaveBeenCalledWith('a');
    expect(container.querySelector('.ace-year-label.is-focus')).toHaveAttribute('data-band-key', '2022');
  });

  it('repairs a cycle in memory while rendering a usable family sheet and node selection', () => {
    const cycle = [
      node('loop-a', 'Fictional Loop A', 'loop-b', 2021, 'FA21'),
      node('loop-b', 'Fictional Loop B', 'loop-a', 2022, 'FA22'),
      node('root', 'Fictional Root', null, 2023, 'FA23'),
    ];
    const { container } = renderTree(cycle);
    expect(container.querySelectorAll('.ace-tree-node')).toHaveLength(3);
    expect(container.querySelectorAll('.ace-tree-edge')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Fictional Loop B, Little, picked up 2022–23' }));
    expect(screen.getByRole('button', { name: 'Fictional Loop B, Little, picked up 2022–23' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.ace-year-label.is-focus')).toHaveAttribute('data-band-key', '2022');
  });

  it('has no serious accessibility violations in both chronological and all-unknown real DOM trees', async () => {
    const year = renderTree(golden);
    expect(await axe(year.container)).toHaveNoViolations();
    year.unmount();
    const undated = renderTree([
      node('big', 'Fictional Big', null, null, null),
      node('little', 'Fictional Little', 'big', null, null),
    ]);
    expect(undated.container.querySelector('.ace-year-rail')).toBeNull();
    expect(screen.getByText('Rows show generations. Pickup years are still being verified.')).toBeInTheDocument();
    expect(await axe(undated.container)).toHaveNoViolations();
  });
});
