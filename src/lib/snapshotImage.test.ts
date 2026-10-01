import { drawSnapshot, shareSnapshotImage, type SnapshotData } from './snapshotImage';

const data: SnapshotData = {
  name: 'Synthetic Member',
  subline: '2027 • Revelle',
  periodLabel: '2025–26 points',
  rankLabel: 'Yearly rank',
  rank: 12,
  points: 1234,
  checkIns: 7,
  allTimePoints: 2345,
  houseLabel: 'Toad',
  houseColor: '#ef4444',
  top10Gap: '15 pts away from Top 10',
  badges: [{ label: 'Regular', color: 'gold' }],
};

function stubContext() {
  const texts: string[] = [];
  const gradient = { addColorStop: jest.fn() };
  const ctx: Record<string, unknown> = {
    createLinearGradient: () => gradient,
    measureText: (t: string) => ({ width: t.length * 10 }),
    fillText: (t: string) => texts.push(t),
  };
  for (const fn of ['fillRect', 'beginPath', 'moveTo', 'arcTo', 'closePath', 'stroke', 'fill', 'save', 'restore', 'arc', 'clip', 'setLineDash', 'drawImage']) {
    ctx[fn] = jest.fn();
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, texts };
}

describe('drawSnapshot', () => {
  it('puts the member\'s real numbers on the image', () => {
    const { ctx, texts } = stubContext();
    drawSnapshot(ctx, data, null);
    expect(texts).toEqual(expect.arrayContaining([
      'Synthetic Member', '1,234', '#12', '7', '2,345', 'TOAD', 'REGULAR', '2025–26 POINTS',
    ]));
    expect(texts.some((t) => t.includes('vsaatucsd.com/points'))).toBe(true);
  });

  it('falls back to initials when there is no photo', () => {
    const { ctx, texts } = stubContext();
    drawSnapshot(ctx, data, null);
    expect(texts).toContain('SM');
  });

  it('never overflows: a very long name is shortened', () => {
    const { ctx, texts } = stubContext();
    drawSnapshot(ctx, { ...data, name: 'A'.repeat(200) }, null);
    const drawn = texts.find((t) => t.startsWith('AAA'));
    expect(drawn && drawn.length).toBeLessThan(200);
  });
});

describe('shareSnapshotImage', () => {
  const blob = new Blob(['png'], { type: 'image/png' });
  const input = { blob, text: 'I am ranked #12', title: 'My VSA Snapshot' };
  const original = { share: (navigator as any).share, canShare: (navigator as any).canShare };
  beforeEach(() => {
    (URL as any).createObjectURL = jest.fn(() => 'blob:x');
    (URL as any).revokeObjectURL = jest.fn();
  });
  afterEach(() => {
    (navigator as any).share = original.share;
    (navigator as any).canShare = original.canShare;
    jest.restoreAllMocks();
  });

  it('shares the PNG file itself, not just a link', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    (navigator as any).share = share;
    (navigator as any).canShare = () => true;
    await expect(shareSnapshotImage(input)).resolves.toBe('shared');
    const arg = share.mock.calls[0][0];
    expect(arg.files).toHaveLength(1);
    expect(arg.files[0]).toMatchObject({ name: 'my-vsa-snapshot.png', type: 'image/png' });
    expect(arg.text).toBe('I am ranked #12');
  });

  it('treats dismissing the share sheet as a cancel, not an error or a download', async () => {
    (navigator as any).share = jest.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    (navigator as any).canShare = () => true;
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await expect(shareSnapshotImage(input)).resolves.toBe('cancelled');
    expect(click).not.toHaveBeenCalled();
  });

  it('downloads the image when the browser cannot share files', async () => {
    (navigator as any).share = undefined;
    (navigator as any).canShare = undefined;
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await expect(shareSnapshotImage(input)).resolves.toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('still hands the user the image when the share sheet is refused', async () => {
    (navigator as any).share = jest.fn().mockRejectedValue(new DOMException('no activation', 'NotAllowedError'));
    (navigator as any).canShare = () => true;
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await expect(shareSnapshotImage(input)).resolves.toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(1);
  });
});
