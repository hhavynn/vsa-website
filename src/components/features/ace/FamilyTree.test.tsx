/* eslint-disable testing-library/no-container, testing-library/no-node-access */
// SVG paths and circles have no accessible role, so the overlay is checked by markup.
import { fireEvent, render, screen } from '@testing-library/react';
import { FamilyTree, TreeNode, layoutTree, lineagePath, lineageTimeline } from './FamilyTree';

let mockReduceMotion = false;
jest.mock('framer-motion', () => ({
  ...jest.requireActual('framer-motion'),
  useReducedMotion: () => mockReduceMotion,
}));

function node(id: string, parent: string | null, role = 'Big'): TreeNode {
  return { id, initial: id.charAt(0).toUpperCase(), label: id, role, parent };
}

// root ─┬─ big ── grandbig ── me
//       └─ aunt ── cousin
const family: TreeNode[] = [
  node('root', null, 'OG · Founder'),
  node('big', 'root'),
  node('aunt', 'root'),
  node('grandbig', 'big'),
  node('cousin', 'aunt', 'Little'),
  node('me', 'grandbig', 'Little'),
];

describe('lineagePath', () => {
  it('walks from the family root down to the selected member', () => {
    expect(lineagePath(family, 'me')).toEqual(['root', 'big', 'grandbig', 'me']);
    expect(lineagePath(family, 'cousin')).toEqual(['root', 'aunt', 'cousin']);
  });

  it('is just the root when the root is selected', () => {
    expect(lineagePath(family, 'root')).toEqual(['root']);
  });

  it('is empty for no selection or an id outside the tree', () => {
    expect(lineagePath(family, null)).toEqual([]);
    expect(lineagePath(family, 'nobody')).toEqual([]);
  });

  it('starts at the highest Big still in the tree when an ancestor is missing', () => {
    const nodes = [node('orphan', 'unpublished-big'), node('little', 'orphan', 'Little')];
    expect(lineagePath(nodes, 'little')).toEqual(['orphan', 'little']);
  });

  it('terminates on a parent cycle instead of looping', () => {
    const nodes = [node('a', 'b'), node('b', 'a')];
    expect(lineagePath(nodes, 'a')).toEqual(['b', 'a']);
  });
});

describe('lineageTimeline', () => {
  it('lights the root first, then each generation after the light reaches it', () => {
    const t = lineageTimeline(4);
    expect(t.nodeDelay(0)).toBe(0);
    for (let i = 0; i < 3; i++) {
      expect(t.edgeDelay(i)).toBeGreaterThan(t.nodeDelay(i));
      expect(t.nodeDelay(i + 1)).toBe(t.edgeDelay(i) + t.edgeDuration);
    }
  });

  it('keeps deep lineages inside a fixed travel budget', () => {
    const t = lineageTimeline(20);
    expect(t.nodeDelay(19)).toBeLessThanOrEqual(2800);
  });

  it('collapses to an instant state for reduced motion', () => {
    const t = lineageTimeline(5, true);
    expect([t.nodeDelay(4), t.edgeDelay(3), t.edgeDuration]).toEqual([0, 0, 0]);
  });
});

describe('layoutTree', () => {
  it('places a member whose Big is not in the tree as a root', () => {
    const { positions } = layoutTree([node('orphan', 'unpublished-big'), node('little', 'orphan')]);
    expect(positions.orphan).toEqual(expect.objectContaining({ y: 0 }));
    expect(positions.little).toEqual(expect.objectContaining({ y: 1 }));
  });
});

describe('FamilyTree lineage spotlight', () => {
  beforeEach(() => {
    mockReduceMotion = false;
  });

  it('renders no spotlight without a selection', () => {
    const { container } = render(<FamilyTree nodes={family} onSelect={() => {}} />);
    expect(screen.queryByTestId('ace-lineage')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).not.toHaveClass('has-lineage');
  });

  it('highlights only the real ancestry path and dims the rest', () => {
    const { container } = render(<FamilyTree nodes={family} focusId="me" onSelect={() => {}} />);

    expect(container.querySelector('svg')).toHaveClass('has-lineage');
    ['root', 'big', 'grandbig', 'me'].forEach((id) => {
      expect(container.querySelector(`[data-node-id="${id}"]`)).toHaveClass('is-lineage');
    });
    ['aunt', 'cousin'].forEach((id) => {
      expect(container.querySelector(`[data-node-id="${id}"]`)).not.toHaveClass('is-lineage');
    });

    const litEdges = Array.from(container.querySelectorAll('[data-lineage-edge]'))
      .map((el) => el.getAttribute('data-lineage-edge'));
    expect(litEdges).toEqual(['root-big', 'big-grandbig', 'grandbig-me']);
    expect(container.querySelectorAll('.ace-tree-edge.is-lineage')).toHaveLength(3);
  });

  it('sequences the light from the root toward the selected member', () => {
    const { container } = render(<FamilyTree nodes={family} focusId="me" onSelect={() => {}} />);

    const delays = Array.from(container.querySelectorAll<SVGElement>('[data-lineage-node]'))
      .map((el) => parseInt(el.style.getPropertyValue('--lineage-delay'), 10));
    expect(delays[0]).toBe(0);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    expect(new Set(delays).size).toBe(4);
    expect(container.querySelectorAll('.ace-lineage-spark').length).toBeGreaterThan(0);
    expect(container.querySelector('.ace-lineage-ripple.is-target')).not.toBeNull();
  });

  it('replays the trace when another member is selected', () => {
    const { rerender } = render(<FamilyTree nodes={family} focusId="me" onSelect={() => {}} />);
    const first = screen.getByTestId('ace-lineage');

    rerender(<FamilyTree nodes={family} focusId="cousin" onSelect={() => {}} />);

    const second = screen.getByTestId('ace-lineage');
    expect(second).not.toBe(first);
    expect(screen.getByRole('button', { name: 'cousin, Little' })).toHaveClass('is-lineage');
    expect(screen.getByRole('button', { name: 'me, Little' })).not.toHaveClass('is-lineage');
  });

  it('shows the lit lineage immediately, without travelling light, for reduced motion', () => {
    mockReduceMotion = true;
    const { container } = render(<FamilyTree nodes={family} focusId="me" onSelect={() => {}} />);

    expect(screen.getByTestId('ace-lineage')).toHaveAttribute('data-motion', 'reduced');
    expect(container.querySelectorAll('.ace-lineage-line')).toHaveLength(3);
    expect(container.querySelector('.ace-lineage-spark')).toBeNull();
    expect(container.querySelector('.ace-lineage-fx')).toBeNull();
    container.querySelectorAll<SVGElement>('[data-lineage-node]').forEach((el) => {
      expect(el.style.getPropertyValue('--lineage-delay')).toBe('0ms');
    });
  });

  it('keeps nodes selectable from the keyboard', () => {
    const onSelect = jest.fn();
    render(<FamilyTree nodes={family} focusId="me" onSelect={onSelect} />);

    const aunt = screen.getByRole('button', { name: 'aunt, Big' });
    fireEvent.keyDown(aunt, { key: ' ' });
    expect(onSelect).toHaveBeenCalledWith('aunt');
    expect(screen.getByRole('button', { name: 'me, Little' })).toHaveAttribute('aria-pressed', 'true');
  });
});
