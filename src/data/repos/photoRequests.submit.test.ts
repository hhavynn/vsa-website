import { photoRequestsRepository } from './photoRequests';

const mockInvoke = jest.fn();
const mockSignedUpload = jest.fn();
const mockDirectUpload = jest.fn();
const mockInsert = jest.fn();
jest.mock('../../lib/supabase', () => ({ supabase: {
  functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  storage: { from: () => ({
    uploadToSignedUrl: (...args: unknown[]) => mockSignedUpload(...args),
    upload: (...args: unknown[]) => mockDirectUpload(...args),
  }) },
  from: () => ({ insert: (...args: unknown[]) => mockInsert(...args) }),
} }));
jest.mock('../../lib/imageUpload', () => ({
  prepareImageForUpload: async (file: File) => ({ file }),
}));
const path = 'pending/00000000-0000-4000-8000-000000000001.webp';
const input = () => ({ matchedMemberId: '00000000-0000-4000-8000-000000000001',
  submittedName: ' Member ', submittedEmail: ' member@ucsd.edu ', consentConfirmed: true,
  file: new File(['bytes'], 'me.webp', { type: 'image/webp' }),
});
beforeEach(() => {
  jest.clearAllMocks();
  mockInvoke.mockResolvedValue({ data: { path, token: 'authorized-token' }, error: null });
  mockSignedUpload.mockResolvedValue({ error: null });
});
it('reserves a quota capability before uploading and avoids direct inserts/uploads', async () => {
  const value = input();
  await photoRequestsRepository.submitPhotoRequest(value);
  expect(mockInvoke).toHaveBeenCalledWith('member-photo-upload', { body: {
    matchedMemberId: value.matchedMemberId, submittedName: 'Member', submittedEmail: 'member@ucsd.edu',
    consentConfirmed: true, noteToAdmins: null, contentType: 'image/webp', size: value.file.size,
  } });
  expect(mockSignedUpload).toHaveBeenCalledWith(path, 'authorized-token', value.file, { contentType: 'image/webp' });
  expect(mockInvoke.mock.invocationCallOrder[0]).toBeLessThan(mockSignedUpload.mock.invocationCallOrder[0]);
  expect(mockDirectUpload).not.toHaveBeenCalled();
  expect(mockInsert).not.toHaveBeenCalled();
});
it('does not upload when broker rejects quota or is unavailable', async () => {
  mockInvoke.mockResolvedValue({ error: { message: 'limit reached' }, data: null });
  await expect(photoRequestsRepository.submitPhotoRequest(input())).rejects.toThrow();
  expect(mockSignedUpload).not.toHaveBeenCalled();
});
it('rejects missing or malformed capabilities before touching storage', async () => {
  for (const data of [null, { path }, { token: 'token', path: '../outside.webp' }]) {
    mockInvoke.mockResolvedValue({ data, error: null });
    await expect(photoRequestsRepository.submitPhotoRequest(input())).rejects.toThrow();
  }
  expect(mockSignedUpload).not.toHaveBeenCalled();
});
it('reports signed-upload failures without trying an unrestricted fallback', async () => {
  mockSignedUpload.mockResolvedValue({ error: { message: 'upload failed' } });
  await expect(photoRequestsRepository.submitPhotoRequest(input())).rejects.toThrow();
  expect(mockDirectUpload).not.toHaveBeenCalled();
  expect(mockInsert).not.toHaveBeenCalled();
});
it('requires consent before invoking the broker', async () => {
  await expect(photoRequestsRepository.submitPhotoRequest({ ...input(), consentConfirmed: false })).rejects.toThrow();
  expect(mockInvoke).not.toHaveBeenCalled();
});
