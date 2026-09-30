/**
 * Admin -> Members photo publishing. Pins the order that keeps the public
 * avatars bucket clean: both objects are uploaded before the RPC records the
 * approved request, and a failed RPC deletes them again, so no photo is ever
 * public without an audited member_photo_requests row. Cleanup only runs once
 * the row is confirmed absent (a lost response must not orphan a committed
 * row's image), and a failed cleanup is reported instead of swallowed.
 */

import { photoRequestsRepository, AVATARS_BUCKET, PENDING_PHOTO_BUCKET } from './photoRequests';
import { ValidationError } from '../errors';

const mockUpload = jest.fn();
const mockRemove = jest.fn();
const mockRpc = jest.fn();
const mockLookup = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, file: File, options: unknown) => mockUpload(bucket, path, file, options),
        remove: (paths: string[]) => mockRemove(bucket, paths),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://example.invalid/storage/v1/object/public/${bucket}/${path}` },
        }),
      }),
    },
    rpc: (fn: string, args: unknown) => mockRpc(fn, args),
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: unknown) => ({
          maybeSingle: () => mockLookup(table, column, value),
        }),
      }),
    }),
  },
}));

// Compression needs a canvas; the repository only cares that it gets a file back.
jest.mock('../../lib/imageUpload', () => ({
  ...jest.requireActual('../../lib/imageUpload'),
  prepareImageForUpload: async (file: File) => ({ file }),
}));

const MEMBER_ID = '00000000-0000-4000-8000-000000000001';
const photo = () => new File(['fake-bytes'], 'me.webp', { type: 'image/webp' });
const rpcFailure = { message: 'Member not found', code: 'P0001' };

// jsdom has no Web Crypto; browsers do.
let uuidCounter = 0;
Object.defineProperty(globalThis, 'crypto', {
  configurable: true,
  value: { randomUUID: () => `uuid-${++uuidCounter}` },
});

beforeEach(() => {
  mockUpload.mockReset().mockResolvedValue({ error: null });
  mockRemove.mockReset().mockImplementation(async (_bucket: string, paths: string[]) => ({
    data: paths.map(name => ({ name })),
    error: null,
  }));
  mockRpc.mockReset().mockResolvedValue({ error: null });
  mockLookup.mockReset().mockResolvedValue({ data: null, error: null });
});

const uploadedPaths = () => ({
  pendingPath: mockUpload.mock.calls[0][1] as string,
  approvedPath: mockUpload.mock.calls[1][1] as string,
});

it('uploads the original and thumbnail, then records the approved request', async () => {
  await photoRequestsRepository.adminPublishMemberPhoto(MEMBER_ID, photo());

  expect(mockUpload).toHaveBeenCalledTimes(2);
  const [pendingBucket, pendingPath] = mockUpload.mock.calls[0];
  const [approvedBucket, approvedPath, , approvedOptions] = mockUpload.mock.calls[1];
  expect(pendingBucket).toBe(PENDING_PHOTO_BUCKET);
  expect(pendingPath).toMatch(/^pending\/.+\.webp$/);
  expect(approvedBucket).toBe(AVATARS_BUCKET);
  expect(approvedPath).toMatch(/^approved\/.+\.webp$/);
  expect(approvedOptions).toMatchObject({ cacheControl: '31536000' });

  expect(mockRpc).toHaveBeenCalledTimes(1);
  const [fn, args] = mockRpc.mock.calls[0];
  expect(fn).toBe('admin_publish_member_photo');
  expect(args).toEqual({
    p_request_id: approvedPath.slice('approved/'.length, -'.webp'.length),
    p_member_id: MEMBER_ID,
    p_pending_path: pendingPath,
    p_approved_path: approvedPath,
    p_public_url: `https://example.invalid/storage/v1/object/public/avatars/${approvedPath}`,
  });
  expect(mockRemove).not.toHaveBeenCalled();
});

it('deletes both uploaded objects when the RPC fails and no row was recorded', async () => {
  mockRpc.mockResolvedValue({ error: rpcFailure });

  await expect(photoRequestsRepository.adminPublishMemberPhoto(MEMBER_ID, photo())).rejects.toThrow();

  const { pendingPath, approvedPath } = uploadedPaths();
  const requestId = mockRpc.mock.calls[0][1].p_request_id;
  expect(mockLookup).toHaveBeenCalledWith('member_photo_requests', 'id', requestId);
  expect(mockRemove).toHaveBeenCalledWith(AVATARS_BUCKET, [approvedPath]);
  expect(mockRemove).toHaveBeenCalledWith(PENDING_PHOTO_BUCKET, [pendingPath]);
});

it('keeps the uploads and succeeds when the RPC committed but its response was lost', async () => {
  mockRpc.mockResolvedValue({ error: { message: 'Failed to fetch' } });
  mockLookup.mockImplementation(async (_table: string, _column: string, id: string) => ({ data: { id }, error: null }));

  await expect(photoRequestsRepository.adminPublishMemberPhoto(MEMBER_ID, photo())).resolves.toBeUndefined();
  expect(mockRemove).not.toHaveBeenCalled();
});

it('keeps the uploads and asks the admin to check when the outcome cannot be confirmed', async () => {
  mockRpc.mockResolvedValue({ error: { message: 'Failed to fetch' } });
  mockLookup.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });

  await expect(photoRequestsRepository.adminPublishMemberPhoto(MEMBER_ID, photo())).rejects.toThrow(
    new ValidationError('Could not confirm whether the photo was published. Check Photo requests before trying again.'),
  );
  expect(mockRemove).not.toHaveBeenCalled();
});

it('reports uploads that could not be deleted instead of hiding them', async () => {
  mockRpc.mockResolvedValue({ error: rpcFailure });
  // Storage RLS filters the public thumbnail's delete out: no error, no objects.
  mockRemove.mockImplementation(async (bucket: string, paths: string[]) => (
    bucket === AVATARS_BUCKET ? { data: [], error: null } : { data: paths.map(name => ({ name })), error: null }
  ));

  const result = photoRequestsRepository.adminPublishMemberPhoto(MEMBER_ID, photo());

  await expect(result).rejects.toBeInstanceOf(ValidationError);
  const { approvedPath, pendingPath } = uploadedPaths();
  await expect(result).rejects.toThrow(`${AVATARS_BUCKET}/${approvedPath}`);
  await expect(result).rejects.not.toThrow(`${PENDING_PHOTO_BUCKET}/${pendingPath}`);
});

it('deletes the pending original when the public thumbnail upload fails', async () => {
  mockUpload
    .mockResolvedValueOnce({ error: null })
    .mockResolvedValueOnce({ error: { message: 'upload failed' } });

  await expect(photoRequestsRepository.adminPublishMemberPhoto(MEMBER_ID, photo())).rejects.toThrow();

  expect(mockRemove).toHaveBeenCalledWith(PENDING_PHOTO_BUCKET, [mockUpload.mock.calls[0][1]]);
  expect(mockRpc).not.toHaveBeenCalled();
});

it('rejects file types the photo buckets do not accept, before uploading', async () => {
  const gif = new File(['gif'], 'me.gif', { type: 'image/gif' });

  await expect(photoRequestsRepository.adminPublishMemberPhoto(MEMBER_ID, gif)).rejects.toBeInstanceOf(
    ValidationError,
  );
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockRpc).not.toHaveBeenCalled();
});
