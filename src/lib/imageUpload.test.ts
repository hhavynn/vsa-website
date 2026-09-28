import { prepareImageForUpload } from './imageUpload';
import { ValidationError, toUserMessage } from '../data/errors';

describe('prepareImageForUpload size limit', () => {
  const oversized = () => new File([new Uint8Array(30 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' });

  it('rejects an oversized image with a ValidationError', async () => {
    await expect(prepareImageForUpload(oversized(), 'avatar')).rejects.toBeInstanceOf(ValidationError);
  });

  it('keeps the actionable size message when shown to a visitor', async () => {
    const error = await prepareImageForUpload(oversized(), 'avatar').catch((caught: unknown) => caught);
    expect(toUserMessage(error, 'Failed to submit photo request. Please try again.')).toMatch(/too large.*MB/i);
  });
});
