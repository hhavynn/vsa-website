import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
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

function renderSheet(onClose = () => {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FamSheet family={family} members={members} accent="teal" viet={null} dark={false} onClose={onClose} />
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
