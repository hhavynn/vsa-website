import { fitText, fitTextLines, shade, withAlpha } from './storyCanvas';

/** Monospace-ish fake: each character is half the font size wide. */
function fakeCtx() {
  const ctx = { font: '' } as unknown as CanvasRenderingContext2D;
  ctx.measureText = (text: string) => {
    const size = Number(/(\d+)px/.exec(ctx.font)?.[1] ?? 0);
    return { width: text.length * size * 0.5 } as TextMetrics;
  };
  return ctx;
}

const opts = { weight: 400, family: 'serif', maxSize: 40, minSize: 20 };

describe('color helpers', () => {
  it('adds alpha to hex colors and passes others through', () => {
    expect(withAlpha('#ff8000', 0.5)).toBe('rgba(255,128,0,0.5)');
    expect(withAlpha('var(--x)', 0.5)).toBe('var(--x)');
  });

  it('darkens hex colors by a factor', () => {
    expect(shade('#ffffff', 0.5)).toBe('#808080');
    expect(shade('#94a3b8', 1)).toBe('#94a3b8');
    expect(shade('red', 0.5)).toBe('red');
  });
});

describe('fitText', () => {
  it('keeps the largest size that fits', () => {
    expect(fitText(fakeCtx(), 'abcd', 80, opts)).toEqual({ text: 'abcd', size: 40 });
    expect(fitText(fakeCtx(), 'abcdefgh', 80, opts)).toEqual({ text: 'abcdefgh', size: 20 });
  });

  it('ellipsizes below the minimum size', () => {
    const fit = fitText(fakeCtx(), 'abcdefghijklmnop', 80, opts);
    expect(fit.size).toBe(20);
    expect(fit.text.endsWith('…')).toBe(true);
  });
});

describe('fitTextLines', () => {
  it('stays on one line when it fits', () => {
    expect(fitTextLines(fakeCtx(), 'Bao Tran', 200, { ...opts, wrapMaxSize: 30 })).toEqual({ lines: ['Bao Tran'], size: 40 });
  });

  it('wraps long names into two balanced lines before ellipsizing', () => {
    const fit = fitTextLines(fakeCtx(), 'Christopher Phuong-Thao Nguyen-Le', 260, { ...opts, wrapMaxSize: 30 });
    expect(fit.lines).toEqual(['Christopher', 'Phuong-Thao Nguyen-Le']);
    expect(fit.size).toBeLessThanOrEqual(30);
  });

  it('ellipsizes a single unbreakable word', () => {
    const fit = fitTextLines(fakeCtx(), 'Supercalifragilisticexpialidocious', 120, { ...opts, wrapMaxSize: 30 });
    expect(fit.lines).toHaveLength(1);
    expect(fit.lines[0].endsWith('…')).toBe(true);
  });
});
