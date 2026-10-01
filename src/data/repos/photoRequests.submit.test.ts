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
function httpError(status: number, body: unknown) {
  return {
    name: 'FunctionsHttpError',
    message: 'Edge Function returned a non-2xx status code',
    context: new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
  };
}
it('shows the broker\'s own message when it rejects a request', async () => {
  mockInvoke.mockResolvedValue({
    data: null,
    error: httpError(429, { error: 'Photo request limit reached. Please contact VSA or try again later.' }),
  });
  await expect(photoRequestsRepository.submitPhotoRequest(input())).rejects.toMatchObject({
    name: 'ValidationError',
    message: 'Photo request limit reached. Please contact VSA or try again later.',
  });
});
it('explains an unavailable broker with no usable body', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: httpError(502, '<html>bad gateway</html>') });
  await expect(photoRequestsRepository.submitPhotoRequest(input())).rejects.toMatchObject({
    name: 'ValidationError',
    message: expect.stringMatching(/photo upload service/i),
  });
});
it('reports a failed network call to the broker as a connection problem', async () => {
  mockInvoke.mockResolvedValue({
    data: null,
    error: { name: 'FunctionsFetchError', message: 'Failed to send a request to the Edge Function' },
  });
  await expect(photoRequestsRepository.submitPhotoRequest(input())).rejects.toMatchObject({
    name: 'NetworkError',
  });
});
it('tells the user when the photo itself could not be uploaded', async () => {
  mockSignedUpload.mockResolvedValue({ error: { message: 'The resource already exists' } });
  await expect(photoRequestsRepository.submitPhotoRequest(input())).rejects.toMatchObject({
    name: 'ValidationError',
    message: expect.stringMatching(/photo could not be uploaded/i),
  });
});
it('rejects unsupported file types before calling the broker', async () => {
  const heic = new File(['x'], 'me.heic', { type: 'image/heic' });
  await expect(
    photoRequestsRepository.submitPhotoRequest({ ...input(), file: heic }),
  ).rejects.toMatchObject({ name: 'ValidationError', message: expect.stringMatching(/JPEG, PNG, or WebP/) });
  expect(mockInvoke).not.toHaveBeenCalled();
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
