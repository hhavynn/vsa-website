/**
 * #291: Characterize member-photo read permissions and avatar pagination.
 * All fixtures are synthetic; never connect this suite to a live backend.
 */
import { photoRequestsRepository } from './photoRequests';
import { postgrestError, supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

const denied = () => postgrestError('permission denied for photo requests', '42501');

describe('Photo Requests read contracts (#291)', () => {
  it('reads only the current member safe-columns view, not private request rows', async () => {
    const ownRequest = {
      id: 'synthetic-request',
      status: 'pending',
      submitted_name: 'Fictional Member',
      storage_path_pending: 'pending/synthetic.webp',
      created_at: '2026-10-01T00:00:00Z',
      reviewed_at: null,
    };
    supabaseMock.queueResult('my_member_photo_requests', { data: [ownRequest], error: null });

    await expect(photoRequestsRepository.getMyPhotoRequests()).resolves.toEqual([ownRequest]);
    const [query] = supabaseMock.queriesFor('my_member_photo_requests');
    const projection = String(query.calls.find(c => c.method === 'select')?.args[0]);
    expect(projection).toBe('id, status, submitted_name, storage_path_pending, created_at, reviewed_at');
    expect(projection).not.toContain('submitted_email');
    expect(projection).not.toContain('note_to_admins');
    expect(projection).not.toContain('admin_notes');
    expect(query.calls).toContainEqual({
      method: 'order', args: ['created_at', { ascending: false }],
    });
    expect(supabaseMock.queriesFor('member_photo_requests')).toHaveLength(0);
  });

  it('distinguishes a successful empty own-request read from access denial', async () => {
    supabaseMock.queueResult('my_member_photo_requests', { data: null, error: null });
    await expect(photoRequestsRepository.getMyPhotoRequests()).resolves.toEqual([]);

    supabaseMock.queueResult('my_member_photo_requests', { data: null, error: denied() });
    await expect(photoRequestsRepository.getMyPhotoRequests()).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501', message: 'Insufficient permissions',
    });
  });

  it('uses only the public approved-avatar view, dropping null member IDs or URLs', async () => {
    supabaseMock.queueResult('public_member_avatars', {
      data: [
        { member_id: 'member-0001', avatar_url: 'https://example.invalid/approved-1.webp' },
        { member_id: 'member-0002', avatar_url: null },
        { member_id: null, avatar_url: 'https://example.invalid/orphan.webp' },
        { member_id: 'member-0003', avatar_url: 'https://example.invalid/approved-3.webp' },
      ],
      error: null,
    });

    const avatars = await photoRequestsRepository.getPublicMemberAvatars();
    expect(Array.from(avatars.entries())).toEqual([
      ['member-0001', 'https://example.invalid/approved-1.webp'],
      ['member-0003', 'https://example.invalid/approved-3.webp'],
    ]);
    const [query] = supabaseMock.queriesFor('public_member_avatars');
    expect(query.calls).toEqual(expect.arrayContaining([
      { method: 'select', args: ['member_id, avatar_url'] },
      { method: 'order', args: ['member_id', { ascending: true }] },
      { method: 'limit', args: [500] },
    ]));
    expect(supabaseMock.queriesFor('member_photo_requests')).toHaveLength(0);
  });

  it('paginates past 500 avatars without silently omitting later members', async () => {
    const rows = Array.from({ length: 502 }, (_, index) => ({
      member_id: `member-${String(index).padStart(4, '0')}`,
      avatar_url: `https://example.invalid/avatar-${index}.webp`,
    }));
    supabaseMock.queueResult('public_member_avatars', { data: rows.slice(0, 500), error: null });
    supabaseMock.queueResult('public_member_avatars', { data: rows.slice(500), error: null });

    const avatars = await photoRequestsRepository.getPublicMemberAvatars();
    expect(avatars.size).toBe(502);
    expect(avatars.get('member-0501')).toBe('https://example.invalid/avatar-501.webp');
    const queries = supabaseMock.queriesFor('public_member_avatars');
    expect(queries).toHaveLength(2);
    expect(queries[1].calls).toContainEqual({
      method: 'gt', args: ['member_id', 'member-0499'],
    });
    expect(queries[1].calls).toContainEqual({ method: 'limit', args: [500] });
  });

  it('rejects an error on a later avatar page rather than returning partial coverage', async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      member_id: `member-${String(index).padStart(4, '0')}`,
      avatar_url: `https://example.invalid/avatar-${index}.webp`,
    }));
    supabaseMock.queueResult('public_member_avatars', { data: firstPage, error: null });
    supabaseMock.queueResult('public_member_avatars', { data: null, error: denied() });
    await expect(photoRequestsRepository.getPublicMemberAvatars()).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
    expect(supabaseMock.queriesFor('public_member_avatars')).toHaveLength(2);
  });

  it('returns an empty avatar Map only after a successful empty read', async () => {
    supabaseMock.queueResult('public_member_avatars', { data: null, error: null });
    await expect(photoRequestsRepository.getPublicMemberAvatars()).resolves.toEqual(new Map());
    supabaseMock.queueResult('public_member_avatars', { data: null, error: denied() });
    await expect(photoRequestsRepository.getPublicMemberAvatars()).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });

  it('keeps admin request columns on the private table and returns empty or error distinctly', async () => {
    const row = {
      id: 'synthetic-request',
      submitted_email: 'fictional@example.invalid',
      admin_notes: 'Synthetic private review',
    };
    supabaseMock.queueResult('member_photo_requests', { data: [row], error: null });
    await expect(photoRequestsRepository.listPhotoRequests()).resolves.toEqual([row]);
    const [query] = supabaseMock.queriesFor('member_photo_requests');
    const projection = String(query.calls.find(c => c.method === 'select')?.args[0]);
    expect(projection).toContain('submitted_email');
    expect(projection).toContain('admin_notes');
    expect(query.calls).toContainEqual({
      method: 'order', args: ['created_at', { ascending: false }],
    });
    expect(supabaseMock.queriesFor('my_member_photo_requests')).toHaveLength(0);

    supabaseMock.queueResult('member_photo_requests', { data: null, error: null });
    await expect(photoRequestsRepository.listPhotoRequests()).resolves.toEqual([]);
    supabaseMock.queueResult('member_photo_requests', { data: null, error: denied() });
    await expect(photoRequestsRepository.listPhotoRequests()).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });

  it('filters private request events by exact request ID and propagates denial', async () => {
    const event = { id: 'synthetic-action', request_id: 'synthetic-request', action: 'reviewed' };
    supabaseMock.queueResult('member_photo_request_events', { data: [event], error: null });
    await expect(photoRequestsRepository.listRequestEvents('synthetic-request'))
      .resolves.toEqual([event]);
    const [query] = supabaseMock.queriesFor('member_photo_request_events');
    expect(query.calls).toContainEqual({
      method: 'eq', args: ['request_id', 'synthetic-request'],
    });
    expect(query.calls).toContainEqual({
      method: 'select', args: ['id, request_id, action, actor, note, created_at'],
    });

    supabaseMock.queueResult('member_photo_request_events', { data: null, error: null });
    await expect(photoRequestsRepository.listRequestEvents('synthetic-request'))
      .resolves.toEqual([]);
    supabaseMock.queueResult('member_photo_request_events', { data: null, error: denied() });
    await expect(photoRequestsRepository.listRequestEvents('synthetic-request'))
      .rejects.toMatchObject({ name: 'DatabaseError', code: '42501' });
  });
});
