import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { FamTabEntry, FamTabs } from './FamTabs';
import { AceFamily } from '../../../types';

jest.mock('../../../hooks/useMemberAvatars', () => ({
  useMemberAvatars: () => new Map(),
}));

function entry(slug: string, name: string): FamTabEntry {
  const family: AceFamily = {
    id: `fam-${slug}`,
    academic_year_start: null,
    academic_year_end: null,
    name,
    slug,
    cover_image_url: null,
    theme_color: null,
    description: null,
    display_order: 0,
    is_published: true,
    created_at: '',
    updated_at: '',
  };
  return { family, accent: 'teal', viet: null, members: [] };
}

const FAMS = [
  entry('sweatpants', 'Sweatpants'),
  entry('sunshine', 'Sunshine'),
  entry('underwater', 'Underwater'),
  entry('down', 'Down'),
];

function Harness() {
  const [selectedId, setSelectedId] = useState(FAMS[0].family.id);
  return <FamTabs fams={FAMS} selectedId={selectedId} onSelect={setSelectedId} onOpenSheet={() => {}} />;
}

const selectedTab = () => screen.getByRole('tab', { selected: true });

describe('FamTabs', () => {
  it('tells visitors how many fams exist beyond the visible tabs', () => {
    render(<Harness />);
    expect(screen.getByText('active fams', { exact: false })).toHaveTextContent('4 active fams');
    expect(screen.getByText('1 / 4')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });

  it('pages through fams with the previous/next pager', () => {
    render(<Harness />);
    const pager = screen.getByRole('navigation', { name: 'Browse ACE fams' });

    // First fam: only a way forward.
    expect(within(pager).queryByRole('button', { name: /previous/i })).not.toBeInTheDocument();
    fireEvent.click(within(pager).getByRole('button', { name: /next fam.*sunshine/i }));
    expect(selectedTab()).toHaveTextContent('Sunshine');
    expect(screen.getByText('2 / 4')).toBeInTheDocument();

    fireEvent.click(within(pager).getByRole('button', { name: /previous.*sweatpants/i }));
    expect(selectedTab()).toHaveTextContent('Sweatpants');
  });

  it('hides the next button on the last fam', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('tab', { name: 'Down' }));
    const pager = screen.getByRole('navigation', { name: 'Browse ACE fams' });
    expect(within(pager).queryByRole('button', { name: /next fam/i })).not.toBeInTheDocument();
    expect(within(pager).getByRole('button', { name: /previous.*underwater/i })).toBeInTheDocument();
  });

  it('keeps focus in the widget when the pressed pager button disappears at the end', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('tab', { name: 'Underwater' }));
    fireEvent.click(screen.getByRole('button', { name: /next fam.*down/i }));
    expect(selectedTab()).toHaveTextContent('Down');
    expect(selectedTab()).toHaveFocus();
  });

  it('ignores arrow keys held with browser-shortcut modifiers', () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight', altKey: true });
    expect(selectedTab()).toHaveTextContent('Sweatpants');
  });

  it('supports arrow-key tab navigation with a roving tabindex', () => {
    render(<Harness />);
    const tablist = screen.getByRole('tablist', { name: 'ACE Families' });

    expect(selectedTab()).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(selectedTab()).toHaveTextContent('Sunshine');
    expect(selectedTab()).toHaveFocus();

    fireEvent.keyDown(tablist, { key: 'End' });
    expect(selectedTab()).toHaveTextContent('Down');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(selectedTab()).toHaveTextContent('Sweatpants');
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(selectedTab()).toHaveTextContent('Down');

    screen.getAllByRole('tab').forEach((tab) => {
      expect(tab).toHaveAttribute('tabindex', tab === selectedTab() ? '0' : '-1');
    });
  });

  it('links the panel to the selected tab', () => {
    render(<Harness />);
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', selectedTab().id);
    expect(selectedTab()).toHaveAttribute('aria-controls', panel.id);
  });
});

describe('ACE Fam image delivery (#303)', () => {
  it('reserves fixed intrinsic sizes and lazy loads decorative tabs and selected fam icon', () => {
    render(<Harness />);
    const tabs = screen.getAllByRole('tab');
    const icons = tabs.map((tab) => tab.querySelector('img'));
    expect(icons.every((icon) => icon !== null)).toBe(true);
    for (const icon of icons) {
      expect(icon).toHaveAttribute('alt', '');
      expect(icon).toHaveAttribute('width', '20');
      expect(icon).toHaveAttribute('height', '20');
      expect(icon).toHaveAttribute('loading', 'lazy');
      expect(icon).toHaveAttribute('decoding', 'async');
    }
    const panelIcon = screen.getByRole('img', { name: 'Sweatpants fam icon' });
    expect(panelIcon).toHaveAttribute('width', '72');
    expect(panelIcon).toHaveAttribute('height', '72');
    expect(panelIcon).toHaveAttribute('loading', 'lazy');
    fireEvent.click(screen.getByRole('tab', { name: 'Sunshine' }));
    expect(screen.getByRole('img', { name: 'Sunshine fam icon' })).toHaveAttribute('width', '72');
  });

  it('uses a correctly sized avatar and restores initials if an approved head photo fails', () => {
    const leader = {
      id: 'fictional-head',
      family_id: FAMS[0].family.id,
      name: 'Ada Fictional',
      role_label: 'Fam Head',
      photo_url: '/images/fictional-ace-head.webp',
      parent_member_id: null,
      member_id: null,
      display_order: 0,
      is_published: true,
      created_at: '',
      updated_at: '',
    };
    render(<FamTabs
      fams={[{ ...FAMS[0], members: [leader] }]}
      selectedId={FAMS[0].family.id}
      onSelect={() => {}}
      onOpenSheet={() => {}}
    />);
    const photo = screen.getByRole('img', { name: 'Ada Fictional' });
    expect(photo).toHaveAttribute('width', '46');
    expect(photo).toHaveAttribute('height', '46');
    expect(photo).toHaveAttribute('loading', 'lazy');
    fireEvent.error(photo);
    expect(screen.queryByRole('img', { name: 'Ada Fictional' })).not.toBeInTheDocument();
    expect(screen.getByText('AF')).toBeInTheDocument();
  });
});
