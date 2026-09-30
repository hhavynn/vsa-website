/**
 * Admin -> Members photo publishing. Pins the order that keeps the public
 * avatars bucket clean: both objects are uploaded before the RPC records the
 * approved request, and a failed RPC deletes them again, so no photo is ever
 * public without an audited member_photo_requests row.
 */

import { photoRequestsRepository, AVATARS_BUCKET, PENDING_PHOTO_BUCKET } from './photoRequests';
import { ValidationError } from '../errors';

const mockUpload = jest.fn();
const mockRemove = jest.fn();
const mockRpc = jest.fn();

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
  },
}));

// Compression needs a canvas; the repository only cares that it gets a file back.
jest.mock('../../lib/imageUpload', () => ({
  ...jest.requireActual('../../lib/imageUpload'),
  prepareImageForUpload: async (file: File) => ({ file }),
}));

const MEMBER_ID = '00000000-0000-4000-8000-000000000001';
const photo = () => new File(['fake-bytes'], 'me.webp', { type: 'image/webp' });

// jsdom has no Web Crypto; browsers do.
let uuidCounter = 0;
Object.defineProperty(globalThis, 'crypto', {
  configurable: true,
  value: { randomUUID: () => `uuid-${++uuidCounter}` },
});

beforeEach(() => {
  mockUpload.mockReset().mockResolvedValue({ error: null });
  mockRemove.mockReset().mockResolvedValue({ error: null });
  mockRpc.mockReset().mockResolvedValue({ error: null });
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

it('deletes both uploaded objects when the RPC fails', async () => {
  mockRpc.mockResolvedValue({ error: { message: 'Permission denied: admin access required', code: 'P0001' } });

  await expect(photoRequestsRepository.adminPublishMemberPhoto(MEMBER_ID, photo())).rejects.toThrow();

  const pendingPath = mockUpload.mock.calls[0][1];
  const approvedPath = mockUpload.mock.calls[1][1];
  expect(mockRemove).toHaveBeenCalledWith(AVATARS_BUCKET, [approvedPath]);
  expect(mockRemove).toHaveBeenCalledWith(PENDING_PHOTO_BUCKET, [pendingPath]);
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
