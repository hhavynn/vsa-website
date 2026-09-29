import { isRenamed, resolveMemberPhoto } from './memberPhotos';
import { membersToTreeNodes } from './aceFamilyAdapter';
import { AceFamilyMember } from '../types';

const avatars = new Map([['member-lynna', 'https://example.test/avatars/approved/lynna.webp']]);

describe('resolveMemberPhoto', () => {
  it("prefers a linked member's approved avatar over the local photo", () => {
    expect(resolveMemberPhoto(avatars, 'member-lynna', 'https://example.test/ace/lynna.jpg')).toBe(
      'https://example.test/avatars/approved/lynna.webp',
    );
  });

  it('keeps the local photo when the linked member has no approved avatar', () => {
    expect(resolveMemberPhoto(avatars, 'member-other', '/images/cabinet/other.webp')).toBe(
      '/images/cabinet/other.webp',
    );
  });

  it('never borrows an avatar for an unlinked person', () => {
    expect(resolveMemberPhoto(avatars, null, null)).toBeNull();
    expect(resolveMemberPhoto(avatars, undefined, '')).toBeNull();
  });
});

describe('membersToTreeNodes', () => {
  const member = (overrides: Partial<AceFamilyMember>): AceFamilyMember => ({
    id: 'node',
    family_id: 'fam',
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
  });

  it('puts the shared avatar on linked nodes and leaves unlinked nodes on initials', () => {
    const nodes = membersToTreeNodes(
      [
        member({ id: 'a', name: 'Lynna On', member_id: 'member-lynna' }),
        member({ id: 'b', name: 'Unlinked Person' }),
      ],
      avatars,
    );

    expect(nodes.map((n) => [n.initial, n.photoUrl])).toEqual([
      ['L', 'https://example.test/avatars/approved/lynna.webp'],
      ['U', null],
    ]);
  });
});

describe('isRenamed', () => {
  it('ignores case and whitespace edits but catches a different person', () => {
    expect(isRenamed('Lynna On', '  lynna   on ')).toBe(false);
    expect(isRenamed('Andy Tran', 'Andy Phan')).toBe(true);
    expect(isRenamed(undefined, 'Lynna On')).toBe(true);
  });
});
